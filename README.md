# Brightness Control — GNOME Shell Extension

A GNOME Shell extension that adds a brightness slider to the Quick Settings panel.

## Features

- Brightness slider integrated into the GNOME Quick Settings panel
- Controls display brightness via D-Bus (`org.gnome.SettingsDaemon.Power.Screen`)
- Compatible with GNOME Shell 45–50
- Written in TypeScript

## Requirements

- GNOME Shell 45 or later
- Node.js 18+ and npm (development only)
- `glib-compile-schemas` (`libglib2.0-bin` on Debian/Ubuntu)

## Development

```bash
# Install dependencies
npm install

# Build (compile TypeScript)
npm run build

# Install the extension locally
make install

# Watch mode (recompile on save)
npm run watch
```

After installing, restart GNOME Shell:

- **X11:** press `Alt+F2`, type `r`, press Enter
- **Wayland:** log out and log back in

Then enable the extension:

```bash
gnome-extensions enable brilho-gnome@akafloor.com.br
```

Or use the **GNOME Extensions** app.

## Publishing to extensions.gnome.org

```bash
# Generate the submission package
make pack
```

Upload `brilho-gnome@akafloor.com.br.zip` at <https://extensions.gnome.org/upload/>.

## Links

- **Repository:** <https://github.com/OtavioAVBelchior/brightness-control-gnome>
- **GNOME Extensions:** <https://extensions.gnome.org/> (after submission)

## Project Structure

```
brilho-gnome/
├── src/
│   ├── extension.ts              # Extension entry point
│   └── types/
│       └── gnome-shell.d.ts      # GNOME Shell type declarations
├── schemas/
│   └── org.gnome.shell.extensions.brilho-gnome.gschema.xml
├── metadata.json                 # Extension manifest (required by GNOME)
├── tsconfig.json
├── package.json
├── Makefile
└── LICENSE
```

## How It Works

The extension connects to the `org.gnome.SettingsDaemon.Power` D-Bus service and
reads/writes the `Brightness` property on the `Power.Screen` interface — the same
mechanism GNOME uses internally to control the display backlight.

## License

GPL-2.0 — see [LICENSE](LICENSE).
