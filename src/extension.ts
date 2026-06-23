import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {
    QuickSlider,
    SystemIndicator,
} from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const POWER_BUS_NAME = 'org.gnome.SettingsDaemon.Power';
const POWER_OBJECT_PATH = '/org/gnome/SettingsDaemon/Power';

const BRIGHTNESS_INTERFACE = `
<node>
  <interface name="org.gnome.SettingsDaemon.Power.Screen">
    <property name="Brightness" type="i" access="readwrite"/>
    <signal name="Changed"/>
  </interface>
</node>`;

const BrightnessDBusProxy = Gio.DBusProxy.makeProxyWrapper(BRIGHTNESS_INTERFACE);

const BrilhoSlider = GObject.registerClass(
    class BrilhoSlider extends QuickSlider {
        private _proxy: any = null;
        private _proxyChangedId = 0;
        private _sliderChangedId = 0;
        private _syncing = false;

        _init() {
            super._init({iconName: 'display-brightness-symbolic'});

            this._sliderChangedId = this.slider.connect('notify::value', () => {
                if (!this._syncing)
                    this._setBrightness(Math.round(this.slider.value * 100));
            });

            new (BrightnessDBusProxy as any)(
                Gio.DBus.session,
                POWER_BUS_NAME,
                POWER_OBJECT_PATH,
                (proxy: any, error: any) => {
                    if (error) {
                        console.error(`Brilho: falha ao conectar ao daemon de energia: ${error.message}`);
                        return;
                    }
                    this._proxy = proxy;
                    this._proxyChangedId = proxy.connectSignal('Changed', () => this._sync());
                    this._sync();
                }
            );
        }

        private _sync() {
            if (!this._proxy) return;
            const value: number = this._proxy.Brightness;
            if (value < 0) return;

            this._syncing = true;
            this.slider.value = value / 100;
            this._syncing = false;
        }

        private _setBrightness(value: number) {
            if (!this._proxy) return;
            this._proxy.Brightness = Math.max(1, Math.min(100, value));
        }

        destroy() {
            if (this._proxyChangedId && this._proxy) {
                this._proxy.disconnectSignal(this._proxyChangedId);
                this._proxyChangedId = 0;
            }
            this._proxy = null;
            super.destroy();
        }
    }
);

const BrilhoIndicator = GObject.registerClass(
    class BrilhoIndicator extends SystemIndicator {
        private _slider: any;

        _init() {
            super._init();
            this._slider = new BrilhoSlider();
            this.quickSettingsItems.push(this._slider);
        }

        destroy() {
            this.quickSettingsItems.forEach((item: any) => item.destroy());
            super.destroy();
        }
    }
);

export default class BrilhoExtension extends Extension {
    private _indicator: any = null;

    enable() {
        this._indicator = new BrilhoIndicator();
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
