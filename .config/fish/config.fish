# ---- FISH ----
set fish_greeting ''
set --global fish_key_bindings fish_vi_key_bindings
bind -M insert \t accept-autosuggestion

# ---- STARSHIP ----
starship init fish | source

# ---- JETBRAINS TOOL BOX ----
set -x PATH $PATH /Users/wphongphanpa/Library/Application\ Support/JetBrains/Toolbox/scripts
set -x PATH $PATH /Users/wphongphanpa/Library/Application\ Support/Coursier/bin

# ---- Zoxide Initialization ----
zoxide init fish | source

# ---- FZF ----
fzf --fish | source

# ---- AEROSPACE ----
function ff
    aerospace list-windows --all | fzf --bind 'enter:execute(bash -c "aerospace focus --window-id {1}")+abort'
end

# ---- YAZI OPEN IN NVIM ----
set -gx EDITOR 'nvim'

# ---- RESHIM AFTER INSTALL, TO PREVENT MISSING $HOME PATH ---
# Auto-reshim after cargo install
function cargo
    command cargo $argv
    and if test "$argv[1]" = "install"
        asdf reshim rust
    end
end

# ---- ALIASES ----
alias leet 'nvim leetcode.nvim'
alias cfg 'nvim ~/.config/fish/config.fish'
alias so 'source ~/.config/fish/config.fish'
alias cl 'clear'
alias ce 'idea .'

# ---- SHORT_HAND_ALIASES ----
alias v 'nvim'
alias l 'eza --color=always --long --git --icons=always --no-time --no-user'
alias g 'lazygit'
alias d 'lazydocker'
alias t 'tmux'
alias ci 'zi'
alias c 'z'
alias y 'yazi'
alias cc 'opencode'
alias q 'pi -p --model big-pickle'

# ---- Agoda Specific ----
source ~/.orbstack/shell/init2.fish 2>/dev/null || :
alias soy-health-check 'watch -n 2 curl -m 1 -sS 127.0.0.1:2501/version'
