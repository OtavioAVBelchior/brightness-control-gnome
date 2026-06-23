UUID     = brilho-gnome@akafloor.com.br
INST_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: all build install uninstall pack clean enable disable

all: build

build:
	npm run build

install: build
	mkdir -p $(INST_DIR)/schemas
	cp -r dist/* $(INST_DIR)/
	cp metadata.json $(INST_DIR)/
	cp schemas/*.xml $(INST_DIR)/schemas/
	glib-compile-schemas $(INST_DIR)/schemas/
	@echo "Extension installed. Restart GNOME Shell (Alt+F2 → r on X11, or log out/in on Wayland)."

uninstall:
	rm -rf $(INST_DIR)
	@echo "Extension removed."

pack: build
	mkdir -p _build/$(UUID)
	cp -r dist/* _build/$(UUID)/
	cp metadata.json _build/$(UUID)/
	mkdir -p _build/$(UUID)/schemas
	cp schemas/*.xml _build/$(UUID)/schemas/
	glib-compile-schemas _build/$(UUID)/schemas/
	cd _build && zip -r ../$(UUID).zip $(UUID)/
	rm -rf _build
	@echo "Package ready: $(UUID).zip"
	@echo "Upload at https://extensions.gnome.org/upload/"

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

clean:
	rm -rf dist _build $(UUID).zip node_modules
