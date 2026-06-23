// Ambient type declarations for GNOME Shell internal modules.
// These are loaded at runtime by GJS from the GNOME Shell installation.

declare module 'resource:///org/gnome/shell/ui/main.js' {
    export const panel: {
        statusArea: {
            quickSettings: {
                addExternalIndicator(indicator: any, colSpan?: number): void;
            };
        };
    };
    export const overview: any;
    export const messageTray: any;
    export function notify(title: string, body?: string): void;
}

declare module 'resource:///org/gnome/shell/ui/quickSettings.js' {
    import GObject from 'gi://GObject';

    interface SliderWidget {
        value: number;
        connect(signal: 'notify::value', callback: () => void): number;
        connect(signal: string, callback: (...args: any[]) => any): number;
    }

    class QuickSettings extends GObject.Object {
        connect(signal: string, callback: (...args: any[]) => any): number;
        destroy(): void;
    }

    class QuickSlider extends QuickSettings {
        slider: SliderWidget;
        iconName: string | null;
        menuEnabled: boolean;
        _init(...args: any[]): void;
        destroy(): void;
    }

    class QuickToggle extends QuickSettings {
        checked: boolean;
        title: string;
        iconName: string | null;
        _init(...args: any[]): void;
        destroy(): void;
    }

    class SystemIndicator extends GObject.Object {
        quickSettingsItems: QuickSettings[];
        _init(...args: any[]): void;
        destroy(): void;
    }

    export {QuickSlider, QuickToggle, SystemIndicator};
}

declare module 'resource:///org/gnome/shell/extensions/extension.js' {
    import Gio from 'gi://Gio';

    class Extension {
        metadata: {
            name: string;
            uuid: string;
            version: number;
            dir: Gio.File;
            path: string;
        };

        constructor(metadata: any);
        enable(): void;
        disable(): void;
        getSettings(schema?: string): any;
        openPreferences(): void;
    }

    export {Extension};
    export default Extension;
}

declare module 'gi://St' {
    class Widget {
        connect(signal: string, callback: (...args: any[]) => any): number;
        destroy(): void;
    }
    export default Widget;
}
