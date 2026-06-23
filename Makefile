UUID = brilho-gnome@akafloor.com.br
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SCHEMA_DIR = schemas

.PHONY: all build install uninstall pack clean enable disable

all: build

build:
	npm run build
	@echo "Build concluído em ./dist/"

install: build
	@mkdir -p $(INSTALL_DIR)
	cp -r dist/* $(INSTALL_DIR)/
	cp metadata.json $(INSTALL_DIR)/
	@mkdir -p $(INSTALL_DIR)/schemas
	cp $(SCHEMA_DIR)/*.xml $(INSTALL_DIR)/schemas/
	glib-compile-schemas $(INSTALL_DIR)/schemas/
	@echo "Extensão instalada em $(INSTALL_DIR)"
	@echo "Reinicie o GNOME Shell (Alt+F2 → r) ou faça logout/login"

uninstall:
	rm -rf $(INSTALL_DIR)
	@echo "Extensão removida"

pack: build
	@mkdir -p _build/$(UUID)
	cp -r dist/* _build/$(UUID)/
	cp metadata.json _build/$(UUID)/
	cp -r schemas _build/$(UUID)/
	glib-compile-schemas _build/$(UUID)/schemas/
	cd _build && zip -r ../$(UUID).zip $(UUID)/
	rm -rf _build
	@echo "Pacote criado: $(UUID).zip"
	@echo "Envie este arquivo em https://extensions.gnome.org/upload/"

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

clean:
	rm -rf dist _build $(UUID).zip node_modules
