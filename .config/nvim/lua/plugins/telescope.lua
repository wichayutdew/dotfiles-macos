-- Telescope Configuration and Keymaps
return function()
	require("telescope").setup({
		defaults = {
			mappings = {
				i = {
					["<esc>"] = require("telescope.actions").close,
				},
				n = {
					["q"] = require("telescope.actions").close,
				},
			},
			wrap_results = true,
			layout_strategy = "flex",
			layout_config = {
				horizontal = {
					prompt_position = "bottom",
					width = 0.9,
					height = 0.9,
					preview_width = 0.5,
				},
			},
		},
		pickers = {
			find_files = {
				hidden = true,
			},
		},
	})

	-- Load extensions
	require("telescope").load_extension("bookmarks")

	-- Keymaps
	local builtin = require("telescope.builtin")
	vim.keymap.set("n", "<leader>fb", builtin.buffers, { desc = "Telescope list buffers" })
	vim.keymap.set("n", "<leader>ff", builtin.find_files, { desc = "Telescope find files" })
	vim.keymap.set("n", "<leader>fs", builtin.live_grep, { desc = "Telescope live grep" })
	vim.keymap.set("n", "<leader>cf", function()
		require("conform").format({
			lsp_fallback = true,
			async = false,
			timeout_ms = 20000,
		})
	end, { desc = "Format file or range" })
	vim.keymap.set("n", "<leader>cl", function()
		require("lint").try_lint()
	end, { desc = "Trigger linting for current file" })
	vim.keymap.set("n", "<leader>ca", vim.lsp.buf.code_action, { desc = "Code actions" })
	vim.keymap.set("n", "gd", function()
		builtin.lsp_definitions({
			file_ignore_patterns = { "%.class$" },
			path_display = { "smart" },
		})
	end, { desc = "Go to definition (source only)" })
	vim.keymap.set("n", "K", vim.lsp.buf.hover, { desc = "Hover documentation" })
	vim.keymap.set("n", "gi", builtin.lsp_implementations, { desc = "Go to implementation" })
	vim.keymap.set("n", "gr", builtin.lsp_references, { desc = "Find references" })
	vim.keymap.set("n", "rn", vim.lsp.buf.rename, { desc = "Rename symbol" })
end
