-- LSP, Mason, Treesitter, and Formatter Configuration
return function()
	---------------------- Mason ---------------------
	require("mason").setup()
	require("mason-lspconfig").setup()
	require("mason-tool-installer").setup({
		ensure_installed = {
			"lua_ls",
			"stylua",
			"rust_analyzer",
			"markdownlint",
			"marksman",
			"jsonls",
			"jq",
			"cucumber_language_server",
			"reformat-gherkin",
			"kotlin_lsp",
			"ktfmt",
			"kotlin-debug-adapter",
			"ts_ls",
			"eslint_d",
			"prettier",
		},
	})

	---------------------- LSP Server Configuration ---------------------
	vim.lsp.enable({
		"lua_ls",
		"rust_analyzer",
		"marksman",
		"jsonls",
		"cucumber_language_server",
		"kotlin_lsp",
		"ts_ls",
	})

	local lsp_capabilities = require("cmp_nvim_lsp").default_capabilities()

	local servers = {
		lua_ls = { capabilities = lsp_capabilities, filetypes = { "lua" } },
		rust_analyzer = { settings = { ["rust-analyzer"] = {} } },
		marksman = { capabilities = lsp_capabilities, filetypes = { "markdown" } },
		jsonls = { capabilities = lsp_capabilities, filetypes = { "json" } },
		cucumber_language_server = { capabilities = lsp_capabilities, filetypes = { "feature" } },
		kotlin_lsp = { capabilities = lsp_capabilities, filetypes = { "kotlin", "kt", "kts" } },
		ts_ls = {
			capabilities = lsp_capabilities,
			filetypes = { "typescript", "javascript", "typescriptreact", "javascriptreact" },
		},
	}

	for server, config in pairs(servers) do
		vim.lsp.config(server, config)
	end

	---------------------- Treesitter ---------------------
	-- main branch: parser installer only, no .configs module
	require("nvim-treesitter").install({
		"lua", "rust", "markdown", "json", "kotlin", "typescript", "javascript",
	})

	-- Native highlighting via vim.treesitter (Nvim 0.12+ core API)
	vim.api.nvim_create_autocmd("FileType", {
		pattern = { "*" },
		callback = function(args)
			local ft = vim.bo[args.buf].filetype
			local lang = vim.treesitter.language.get_lang(ft)
			if lang and pcall(vim.treesitter.language.add, lang) then
				pcall(vim.treesitter.start, args.buf, lang)
			end
		end,
	})

	---------------------- Formatter ---------------------
	require("conform").setup({
		formatters_by_ft = {
			lua = { "stylua" },
			rust = { "rustfmt" },
			markdown = { "markdownlint" },
			json = { "jq" },
			cucumber = { "reformat-gherkin" },
			kotlin = { "ktfmt" },
			javascript = { "prettier" },
			typescript = { "prettier" },
			javascriptreact = { "prettier" },
			typescriptreact = { "prettier" },
		},
	})

	---------------------- Linter ---------------------
	require("lint").linters_by_ft = {
		javascript = { "eslint_d" },
		typescript = { "eslint_d" },
		javascriptreact = { "eslint_d" },
		typescriptreact = { "eslint_d" },
	}

	---------------------- Diagnostic Signs ---------------------
	local sign = function(opts)
		vim.fn.sign_define(opts.name, {
			texthl = opts.name,
			text = opts.text,
			numhl = "",
		})
	end
	sign({ name = "DiagnosticSignError", text = "✘" })
	sign({ name = "DiagnosticSignWarn", text = "▲" })
	sign({ name = "DiagnosticSignHint", text = "⚑" })
	sign({ name = "DiagnosticSignInfo", text = "»" })
	vim.diagnostic.config({
		virtual_text = true,
		severity_sort = true,
		float = {
			border = "rounded",
			source = true,
		},
	})

	--------------------- FOLDING ---------------------
	require("ufo").setup({
		provider_selector = function()
			return { "treesitter", "indent" }
		end,
	})

	vim.keymap.set("n", "fd", "za", { desc = "Toggle fold" })
	vim.keymap.set("n", "fa", "zA", { desc = "Toggle all folds recursively" })
end
