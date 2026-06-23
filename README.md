# Brilho — GNOME Shell Extension

Controle o brilho do seu monitor diretamente pelo painel rápido do GNOME Shell.

## Funcionalidades

- Slider de brilho integrado ao painel rápido (Quick Settings)
- Controle via D-Bus (`org.gnome.SettingsDaemon.Power.Screen`)
- Compatível com GNOME Shell 45–50
- Escrito em TypeScript

## Requisitos

- GNOME Shell 45 ou superior
- Node.js 18+ e npm (apenas para desenvolvimento)
- `glib-compile-schemas` (pacote `libglib2.0-bin` no Debian/Ubuntu)

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Compilar TypeScript
npm run build

# Instalar a extensão localmente
make install

# Recompilar ao salvar (modo watch)
npm run watch
```

Após instalar, reinicie o GNOME Shell:
- **X11:** pressione `Alt+F2`, digite `r` e pressione Enter
- **Wayland:** faça logout e login novamente

Depois ative a extensão:
```bash
gnome-extensions enable brilho-gnome@akafloor.com.br
```

Ou use o aplicativo **GNOME Extensions**.

## Publicar no extensions.gnome.org

```bash
# Gerar o pacote .zip para envio
make pack
```

Envie o arquivo `brilho-gnome@akafloor.com.br.zip` em https://extensions.gnome.org/upload/

## Estrutura do Projeto

```
brilho-gnome/
├── src/
│   ├── extension.ts        # Código principal da extensão
│   └── types/
│       └── gnome-shell.d.ts  # Declarações de tipo para GNOME Shell
├── schemas/
│   └── org.gnome.shell.extensions.brilho-gnome.gschema.xml
├── metadata.json           # Metadados da extensão (obrigatório)
├── tsconfig.json
├── package.json
├── Makefile
└── LICENSE
```

## Como Funciona

A extensão conecta ao serviço D-Bus `org.gnome.SettingsDaemon.Power` e lê/escreve
a propriedade `Brightness` da interface `Power.Screen`. Isso é o mesmo mecanismo
que o GNOME usa internamente para controlar o backlight do display.

## Licença

GPL-2.0 — veja [LICENSE](LICENSE).
