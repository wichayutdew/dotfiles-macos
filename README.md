# Dotfiles & Workstation Setup

Personal environment bootstrap and configuration.

## Setup Flow

```mermaid
flowchart TD
    A[Install Homebrew & 1Password] --> B[Login 1Password & Clone Repo]
    B --> C[Run .config/setup.sh]
    C --> D[Restart Terminal -> Fish Shell]
    D --> E[Run fish init.fish]
    E --> F[Configure Secrets in environment.fish]
```

## Quick Start

```bash
# 1. Prerequisites
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install --cask 1password

# 2. Setup
cd .config
bash setup.sh

# 3. Initialize Fish
fish init.fish
```

### Environment Secrets
Add custom environment variables to `~/.config/fish/conf.d/environment.fish`:
```fish
set -gx SECRET_NAME ${SECRET}
```

## Update Installed Tools

Run `update` in Fish to execute these commands in order:

```fish
brew upgrade
mise upgrade
npx skills update
```

Missing tools are skipped. If an update fails, the remaining commands still run and
`update` returns a nonzero exit status. Commands keep their normal prompts and
output. Run from the directory whose configuration you intend to use: mise and
skills retain their normal current-directory scope, and mise respects configured
version ranges.

## System Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd + \`` | Change input language |
| `Cmd + Space` | Raycast launcher |
| Hot corner (bottom right) | Show desktop |

## Vimium Keymaps

```vim
unmap J
unmap K
map J nextTab
map K previousTab
unmap <c-e>
unmap <c-y>
unmap d
unmap u
map <c-d> scrollPageDown
map <c-u> scrollPageUp
unmap x
map d removeTab
unmap gt
unmap gT
unmap b
unmap B
```
