-- UI Plugins Configuration
return function()
	--------------------- COLORSCHEME ---------------------
	require("gruvbox-material").setup({
		italics = true,
		contrast = "soft",
		comments = {
			italics = true,
		},
		background = {
			transparent = true,
		},
		customize = function(g, o)
			if g == "Comment" then
				o.fg = "#8A8A8A"
			end
			if g == "LineNr" then
				o.fg = "#8A8A8A"
			end
			if g == "CursorLineNr" then
				o.fg = "#FF8200"
				o.bold = true
			end
			return o
		end,
	})

	--------------------- LUALINE ---------------------
	require("lualine").setup({
		options = {
			theme = require("gruvbox-material.lualine").theme("medium"),
		},
	})

	--------------------- NOICE ---------------------
	require("noice").setup({ notify = { enabled = false } })

	---------------------- BOOKMARK ---------------------
	require("bookmarks").setup({
		sign_priority = 20,
		save_file = vim.fn.expand("$HOME/.bookmarks"),
		on_attach = function(_)
			local bm = require("bookmarks")
			vim.keymap.set("n", "<leader>s", bm.bookmark_toggle, { desc = "Add bookmark" })
		end,
	})

	-- Keymaps
	vim.keymap.set("n", "<leader>S", ":Telescope bookmarks list<CR>", { desc = "List all bookmarks" })

	---------------------- Render Markdown ---------------------
	require("render-markdown").setup({
		completions = { lsp = { enabled = true } },
	})

	---------------------- Markdown Preview ---------------------
	require("markdown_preview").setup({})
	vim.keymap.set("n", "<leader>mp", "<cmd>MarkdownPreview<CR>", { desc = "Preview Markdown or Mermaid" })
	vim.keymap.set("n", "<leader>ms", "<cmd>MarkdownPreviewStop<CR>", { desc = "Stop Markdown or Mermaid preview" })

	--------------------- INDENT BLANKLINE ---------------------
	require("ibl").setup({})
end
