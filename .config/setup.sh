#!/usr/bin/env bash
set -e

echo "========== Installing Homebrew bundle =========="
brew bundle --file ~/.config/Brewfile

echo "========== Agoda Essentials ========="
brew tap devops/tap git@gitlab.agodadev.io:devops/homebrew.git && brew install devstack

echo "========== Installing Languages Framework =========="
mise use --global java@zulu-21
mise use --global node@25
mise use --global poetry
mise use --global python@3.13
mise use --global rust

asdf plugin add neovim || true
asdf install neovim nightly
asdf set -u neovim nightly

echo "========== Make Fish default shell =========="
echo "/opt/homebrew/bin/fish" | sudo tee -a /etc/shells
chsh -s /opt/homebrew/bin/fish
