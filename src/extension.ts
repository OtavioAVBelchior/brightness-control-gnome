import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {
    QuickSlider,
    SystemIndicator,
} from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

type BackendKind = 'backlight' | 'ddcutil' | 'xrandr';

interface MonitorInfo {
    name: string;
    kind: BackendKind;
    target: string; // backlight: device name | ddcutil: bus number | xrandr: output name
}

// ── Subprocess helper ──────────────────────────────────────────────────────

function runCmd(argv: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        let proc: Gio.Subprocess;
        try {
            proc = Gio.Subprocess.new(
                argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            );
        } catch (e) {
            reject(e);
            return;
        }
        proc.communicate_utf8_async(null, null, (source, result) => {
            try {
                const [, stdout] = source!.communicate_utf8_finish(result);
                resolve(stdout ?? '');
            } catch (e) {
                reject(e);
            }
        });
    });
}

function readSysFile(path: string): string {
    const [ok, data] = GLib.file_get_contents(path);
    if (!ok) throw new Error(`Cannot read ${path}`);
    return new TextDecoder().decode(data).trim();
}

// ── Monitor detection ──────────────────────────────────────────────────────

// Internal display: reads /sys/class/backlight/, no extra packages needed
function detectBacklights(): MonitorInfo[] {
    const monitors: MonitorInfo[] = [];
    try {
        const dir = Gio.File.new_for_path('/sys/class/backlight');
        const iter = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let info = iter.next_file(null);
        while (info !== null) {
            const device = info.get_name();
            try {
                const max = parseInt(readSysFile(`/sys/class/backlight/${device}/max_brightness`));
                if (max > 0)
                    monitors.push({name: 'Built-in Display', kind: 'backlight', target: device});
            } catch { /* skip invalid device */ }
            info = iter.next_file(null);
        }
        iter.close(null);
    } catch { /* no backlight directory */ }
    return monitors;
}

function parseDdcutil(output: string): MonitorInfo[] {
    const monitors: MonitorInfo[] = [];
    const sections = ('\n' + output).split(/\n(?=Display \d+|Invalid display)/);
    for (const section of sections) {
        if (!section.trim().startsWith('Display ')) continue;
        const busMatch = section.match(/\/dev\/i2c-(\d+)/);
        const modelMatch = section.match(/Model:\s+(\S[^\n]*)/);
        if (!busMatch) continue;
        monitors.push({
            name: modelMatch?.[1]?.trim() || `Monitor ${busMatch[1]}`,
            kind: 'ddcutil',
            target: busMatch[1],
        });
    }
    return monitors;
}

function parseXrandr(output: string): MonitorInfo[] {
    const monitors: MonitorInfo[] = [];
    for (const line of output.split('\n').slice(1)) {
        const m = line.match(/^\s*\d+:\s+[+*]*\S+\s+\S+\s+(\S+)$/);
        if (!m) continue;
        const name = m[1];
        if (/^(eDP|LVDS|DSI)/i.test(name)) continue; // skip internal — already covered by backlight
        monitors.push({name, kind: 'xrandr', target: name});
    }
    return monitors;
}

async function detectAllMonitors(): Promise<MonitorInfo[]> {
    const all: MonitorInfo[] = [];

    // 1. Internal display via sysfs backlight (always, no extra packages)
    all.push(...detectBacklights());

    // 2. External monitors via DDC/CI — hardware brightness
    let externalFound = false;
    if (GLib.find_program_in_path('ddcutil')) {
        try {
            const out = await runCmd(['ddcutil', 'detect']);
            const ddc = parseDdcutil(out);
            if (ddc.length > 0) {
                all.push(...ddc);
                externalFound = true;
            }
        } catch { /* fall through */ }
    }

    // 3. External monitors via xrandr — software brightness fallback
    if (!externalFound && GLib.find_program_in_path('xrandr')) {
        try {
            const out = await runCmd(['xrandr', '--listmonitors']);
            all.push(...parseXrandr(out));
        } catch { /* fall through */ }
    }

    return all;
}

// ── Backlight control via systemd-logind D-Bus ─────────────────────────────
// Works without root. Requires systemd (standard on Ubuntu/Fedora/Arch).

function setBacklightBrightness(device: string, pct: number): void {
    const max = parseInt(readSysFile(`/sys/class/backlight/${device}/max_brightness`));
    const raw = Math.max(1, Math.round(pct / 100 * max));

    (Gio.DBus.system as any).call_sync(
        'org.freedesktop.login1',
        '/org/freedesktop/login1/session/auto',
        'org.freedesktop.login1.Session',
        'SetBrightness',
        new GLib.Variant('(ssu)', ['backlight', device, raw]),
        null,
        Gio.DBusCallFlags.NONE,
        -1,
        null,
    );
}

// ── Slider widget ──────────────────────────────────────────────────────────

const MonitorSlider = GObject.registerClass(
    class MonitorSlider extends QuickSlider {
        private _monitor!: MonitorInfo;
        private _debounceId = 0;
        private _syncing = false;
        private _setting = false;
        private _pendingValue: number | null = null;

        _init(monitor: MonitorInfo) {
            super._init({iconName: 'display-brightness-symbolic'});
            this._monitor = monitor;
            (this as any).accessible_name = monitor.name;
            (this as any).add_style_class_name('brightness-control-slider');

            this.slider.connect('notify::value', () => {
                if (!this._syncing)
                    this._scheduleSet(Math.round(this.slider.value * 100));
            });

            this._loadBrightness();
        }

        private async _loadBrightness() {
            const {kind, target} = this._monitor;
            try {
                if (kind === 'backlight') {
                    const current = parseFloat(readSysFile(`/sys/class/backlight/${target}/actual_brightness`));
                    const max = parseFloat(readSysFile(`/sys/class/backlight/${target}/max_brightness`));
                    this._syncing = true;
                    this.slider.value = current / max;
                    this._syncing = false;
                } else if (kind === 'ddcutil') {
                    const out = await runCmd([
                        'ddcutil', 'getvcp', '10',
                        '--bus', target, '--brief', '--sleep-multiplier', '0.5',
                    ]);
                    const m = out.match(/VCP\s+\S+\s+C\s+(\d+)\s+(\d+)/);
                    if (m) {
                        this._syncing = true;
                        this.slider.value = parseInt(m[1]) / parseInt(m[2]);
                        this._syncing = false;
                    }
                } else {
                    const out = await runCmd(['xrandr', '--verbose']);
                    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const m = out.match(new RegExp(`${escaped} connected[\\s\\S]*?Brightness:\\s*([\\d.]+)`));
                    this._syncing = true;
                    this.slider.value = m ? parseFloat(m[1]) : 1.0;
                    this._syncing = false;
                }
            } catch (e) {
                console.error(`[BrilhoGNOME] get ${target}: ${e}`);
            }
        }

        private _scheduleSet(pct: number) {
            if (this._debounceId)
                GLib.source_remove(this._debounceId);

            this._debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
                this._debounceId = 0;
                this._applyBrightness(Math.max(1, Math.min(100, pct)));
                return false;
            });
        }

        private async _applyBrightness(pct: number) {
            if (this._setting) {
                this._pendingValue = pct;
                return;
            }
            this._setting = true;
            try {
                const {kind, target} = this._monitor;
                if (kind === 'backlight') {
                    setBacklightBrightness(target, pct);
                } else if (kind === 'ddcutil') {
                    await runCmd([
                        'ddcutil', 'setvcp', '10', String(pct),
                        '--bus', target, '--noverify', '--sleep-multiplier', '0.5',
                    ]);
                } else {
                    await runCmd(['xrandr', '--output', target, '--brightness', (pct / 100).toFixed(2)]);
                }

                if (this._pendingValue !== null) {
                    const pending = this._pendingValue;
                    this._pendingValue = null;
                    this._setting = false;
                    await this._applyBrightness(pending);
                    return;
                }
            } catch (e) {
                console.error(`[BrilhoGNOME] set ${this._monitor.target}: ${e}`);
            }
            this._setting = false;
        }

        destroy() {
            if (this._debounceId) {
                GLib.source_remove(this._debounceId);
                this._debounceId = 0;
            }
            super.destroy();
        }
    }
);

// ── Indicator ──────────────────────────────────────────────────────────────

const BrightnessIndicator = GObject.registerClass(
    class BrightnessIndicator extends SystemIndicator {
        _init(monitors: MonitorInfo[]) {
            super._init();
            for (const m of monitors)
                this.quickSettingsItems.push(new MonitorSlider(m));
        }

        destroy() {
            this.quickSettingsItems.forEach((item: any) => item.destroy());
            super.destroy();
        }
    }
);

// ── Extension entry point ──────────────────────────────────────────────────

export default class BrightnessControlExtension extends Extension {
    private _indicator: any = null;
    private _enabled = false;

    enable() {
        this._enabled = true;

        detectAllMonitors()
            .then(monitors => {
                if (!this._enabled) return;
                if (monitors.length === 0) {
                    Main.notify(
                        'Brightness Control',
                        'No monitors detected. For external monitors install ddcutil:\n  sudo apt install ddcutil',
                    );
                    return;
                }
                this._indicator = new BrightnessIndicator(monitors);
                Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
            })
            .catch(e => console.error('[BrilhoGNOME]', e));
    }

    disable() {
        this._enabled = false;
        this._indicator?.destroy();
        this._indicator = null;
    }
}
