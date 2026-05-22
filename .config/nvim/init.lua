--------------------- PATH ---------------------
vim.env.PATH = "/opt/homebrew/bin:" .. vim.env.PATH

--------------------- EDITOR SETTINGS ---------------------
vim.g.mapleader = " "
vim.g.maplocalleader = " "
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.scrolloff = 999
vim.opt.wrap = false
vim.opt.colorcolumn = "80"
vim.opt.sidescrolloff = 8
vim.opt.tabstop = 2
vim.opt.shiftwidth = 2
vim.opt.winborder = "rounded"
vim.opt.termguicolors = true
vim.opt.ignorecase = true
vim.opt.smartcase = true
vim.opt.cursorline = true

--------------------- CODE FOLDING ---------------------
vim.o.foldcolumn = "1"
vim.o.foldlevel = 99
vim.o.foldlevelstart = 99
vim.o.foldenable = true

--------------------- BASIC KEYMAPS ---------------------
vim.keymap.set("n", "<leader>ww", ":bd<CR>", { desc = "Close buffer" })
vim.keymap.set({ "n", "v", "x" }, "Y", '"+y')
vim.keymap.set("n", "k", "kzz")
vim.keymap.set("n", "j", "jzz")
vim.keymap.set("n", "<C-d>", "<C-d>zz")
vim.keymap.set("n", "<C-u>", "<C-u>zz")
vim.keymap.set("i", "jk", "<esc>")
vim.keymap.set("n", "//", ":noh<CR>")

--------------------- WINDOW NAVIGATION ---------------------
vim.keymap.set("n", "<leader>wv", ":vsplit<CR>", { desc = "Split vertically" })
vim.keymap.set("n", "<leader>wh", ":split<CR>", { desc = "Split horizontally" })

--------------------- AUTOCMDS ---------------------
vim.api.nvim_create_autocmd("TextYankPost", {
	callback = function()
		vim.highlight.on_yank()
	end,
})

--------------------- PACKAGE MANAGER ---------------------
vim.pack.add({
	--------------------- PRE-REQUISUTES ---------------------
	{ src = "https://github.com/nvim-lua/plenary.nvim" }, -- Required by many plugins
	{ src = "https://github.com/MunifTanjim/nui.nvim" }, -- required by leetcode nvim and other packages
	{ src = "https://github.com/kevinhwang91/promise-async" }, -- required by nvim-ufo
	{ src = "https://github.com/folke/snacks.nvim" }, -- required by claude code
	{ src = "https://github.com/nvim-neotest/nvim-nio" }, -- required by nvim-dap-ui
	--------------------- LSP ---------------------
	{ src = "https://github.com/mason-org/mason.nvim" },
	{ src = "https://github.com/WhoIsSethDaniel/mason-tool-installer.nvim" },
	{ src = "https://github.com/nvim-treesitter/nvim-treesitter", version = "main" },
	{ src = "https://github.com/stevearc/conform.nvim" },
	{ src = "https://github.com/mfussenegger/nvim-lint" },
	--------------------- DAP ---------------------
	{ src = "https://github.com/mfussenegger/nvim-dap" },
	{ src = "https://github.com/rcarriga/nvim-dap-ui" },
	{ src = "https://github.com/theHamsta/nvim-dap-virtual-text" },
	--------------------- TELESCOPE(FZF) ---------------------
	{ src = "https://github.com/nvim-telescope/telescope.nvim" },
	{ src = "https://github.com/nvim-telescope/telescope-dap.nvim" },
	--------------------- MINI ---------------------
	{ src = "https://github.com/nvim-mini/mini.icons" }, -- add icons
	{ src = "https://github.com/nvim-mini/mini.surround" }, -- Surroundings like parentheses, quotes, etc.
	{ src = "https://github.com/echasnovski/mini.ai" }, -- e.g. q as " ' and b as ( [ {
	{ src = "https://github.com/nvim-mini/mini.files" },
	{ src = "https://github.com/nvim-mini/mini.pairs" },
	{ src = "https://github.com/nvim-mini/mini.cursorword" },
	{ src = "https://github.com/nvim-mini/mini.diff" },
	{ src = "https://github.com/nvim-mini/mini.clue" },
	{ src = "https://github.com/nvim-mini/mini.jump" },
	{ src = "https://github.com/nvim-mini/mini.jump2d" },
	--------------------- UI ---------------------
	{ src = "https://github.com/MeanderingProgrammer/render-markdown.nvim" }, -- render markdown
	{ src = "https://github.com/tomasky/bookmarks.nvim" },
	{ src = "https://github.com/f4z3r/gruvbox-material.nvim" },
	{ src = "https://github.com/folke/noice.nvim" }, -- Better command line and messages
	{ src = "https://github.com/nvim-lualine/lualine.nvim" },
	{ src = "https://github.com/lukas-reineke/indent-blankline.nvim" },
	{ src = "https://github.com/kevinhwang91/nvim-ufo" }, -- Better folding
	--------------------- EXTRA ---------------------
	{ src = "https://github.com/kawre/leetcode.nvim" }, -- doing leetcode inside neovim
})

--------------------- PLUGIN CONFIGURATIONS ---------------------
require("plugins.lsp")()
require("plugins.completion")()
require("plugins.dap")()
require("plugins.telescope")()
require("plugins.mini")()
require("plugins.ui")()
require("plugins.extra")()
