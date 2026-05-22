-- Native LSP Completion
return function()
	vim.opt.completeopt = { "menu", "menuone", "noselect" }

	vim.api.nvim_create_autocmd("LspAttach", {
		callback = function(args)
			local client = vim.lsp.get_client_by_id(args.data.client_id)
			if client and client.supports_method("textDocument/completion") then
				vim.lsp.completion.enable(true, args.data.client_id, args.buf, {
					autotrigger = true,
				})
			end
		end,
	})

	-- Tab: navigate completion menu or trigger completion
	vim.keymap.set("i", "<Tab>", function()
		if vim.fn.pumvisible() == 1 then
			return "<C-n>"
		end
		local col = vim.fn.col(".") - 1
		if col == 0 or vim.fn.getline("."):sub(col, col):match("%s") then
			return "<Tab>"
		end
		return "<C-x><C-o>"
	end, { expr = true, desc = "Completion: next or trigger" })

	-- S-Tab: navigate backwards in completion menu
	vim.keymap.set("i", "<S-Tab>", function()
		return vim.fn.pumvisible() == 1 and "<C-p>" or "<S-Tab>"
	end, { expr = true, desc = "Completion: prev" })

	-- CR: confirm selection
	vim.keymap.set("i", "<CR>", function()
		return vim.fn.pumvisible() == 1 and "<C-y>" or "<CR>"
	end, { expr = true, desc = "Completion: confirm" })
end
