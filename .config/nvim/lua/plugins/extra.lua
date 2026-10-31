-- Leetcode Configuration
return function()
	require("leetcode").setup({
		arg = "leetcode.nvim",
		lang = "rust",
		storage = {
			home = vim.fn.stdpath("data") .. "/leetcode",
			cache = vim.fn.stdpath("cache") .. "/leetcode",
		},
		plugins = {
			non_standalone = false,
		},
		logging = true,
		cache = {
			update_interval = 60 * 60 * 24 * 7,
		},
		editor = {
			reset_previous_code = true,
			fold_imports = true,
		},
		console = {
			open_on_runcode = true,
			dir = "row",
			size = {
				width = "90%",
				height = "75%",
			},
			result = {
				size = "70%",
			},
			testcase = {
				virt_text = true,
				size = "30%",
			},
		},
		description = {
			position = "right",
			width = "60%",
			show_stats = true,
		},
		keys = {
			toggle = { "q" },
			confirm = { "<CR>" },
			reset_testcases = "r",
			use_testcase = "U",
			focus_testcases = "H",
			focus_result = "L",
		},
		image_support = false,
		theme = {
			["alt"] = {
				bg = "#FFFFFF",
			},
			["normal"] = {
				fg = "#EA4AAA",
			},
		},
	})

	-- Keymaps
	vim.keymap.set("n", "<leader>lf", ":Leet list<CR>", { desc = "List all Leetcode question" })
	vim.keymap.set("n", "<leader>le", ":Leet desc<CR>", { desc = "Toggle question description" })
	vim.keymap.set("n", "<leader>ld", ":Leet run<CR>", { desc = "Run test" })
	vim.keymap.set("n", "<leader>lr", ":Leet Submit<CR>", { desc = "Submit" })
	vim.keymap.set("n", "<leader>lgx", ":Leet Open<CR>", { desc = "Open in browser" })
end
