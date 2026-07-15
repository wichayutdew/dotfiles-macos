-- LSP, Mason, Treesitter, and Formatter Configuration
return function()
	---------------------- Mason ---------------------
	require("mason").setup()
	require("mason-tool-installer").setup({
		ensure_installed = {
			"lua-language-server",
			"stylua",
			"rust-analyzer",
			"markdownlint",
			"marksman",
			"json-lsp",
			"jq",
			"kotlin-lsp",
			"ktfmt",
			"kotlin-debug-adapter",
			"detekt",
			"typescript-language-server",
			"eslint_d",
			"prettier",
		},
	})

	---------------------- LSP Server Configuration ---------------------
	local lsp_capabilities = vim.lsp.protocol.make_client_capabilities()

	local servers = {
		lua_ls = {
			cmd = { "lua-language-server" },
			capabilities = lsp_capabilities,
			filetypes = { "lua" },
		},
		rust_analyzer = {
			cmd = { "rust-analyzer" },
			capabilities = lsp_capabilities,
			filetypes = { "rust" },
			root_markers = { "Cargo.toml", "Cargo.lock" },
			settings = { ["rust-analyzer"] = {} },
		},
		marksman = {
			cmd = { "marksman", "server" },
			capabilities = lsp_capabilities,
			filetypes = { "markdown" },
		},
		jsonls = {
			cmd = { "vscode-json-language-server", "--stdio" },
			capabilities = lsp_capabilities,
			filetypes = { "json" },
		},
		kotlin_lsp = {
			cmd = { "intellij-server", "--stdio" },
			capabilities = lsp_capabilities,
			filetypes = { "kotlin" },
			root_markers = {
				"build.gradle",
				"build.gradle.kts",
				"settings.gradle",
				"settings.gradle.kts",
				"pom.xml",
			},
		},
		ts_ls = {
			cmd = { "typescript-language-server", "--stdio" },
			capabilities = lsp_capabilities,
			filetypes = { "typescript", "javascript", "typescriptreact", "javascriptreact" },
		},
	}

	for server, config in pairs(servers) do
		vim.lsp.config(server, config)
	end

	vim.lsp.enable({
		"lua_ls",
		"rust_analyzer",
		"marksman",
		"jsonls",
		"kotlin_lsp",
		"ts_ls",
	})

	---------------------- Treesitter ---------------------
	vim.api.nvim_create_autocmd("VimEnter", {
		once = true,
		callback = function()
			require("nvim-treesitter").install({
				"lua",
				"rust",
				"markdown",
				"json",
				"kotlin",
				"typescript",
				"javascript",
				"html",
			})
		end,
	})

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
		formatters = {
			spotless = {
				command = "./gradlew",
				args = { "spotlessApply" },
				cwd = function()
					return vim.fn.getcwd()
				end,
				stdin = false,
			},
		},
	})

	---------------------- Linter ---------------------
	require("lint").linters_by_ft = {
		javascript = { "eslint_d" },
		typescript = { "eslint_d" },
		javascriptreact = { "eslint_d" },
		typescriptreact = { "eslint_d" },
		kotlin = { "detekt" },
	}

	---------------------- Diagnostic Signs ---------------------
	vim.diagnostic.config({
		signs = {
			text = {
				[vim.diagnostic.severity.ERROR] = "✘",
				[vim.diagnostic.severity.WARN] = "▲",
				[vim.diagnostic.severity.HINT] = "⚑",
				[vim.diagnostic.severity.INFO] = "»",
			},
		},
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
