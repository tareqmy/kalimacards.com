# --- KalimaCards Developer Makefile ---

.PHONY: help run serve

# Default port for the local server
PORT ?= 8000

help:
	@echo "KalimaCards Development Commands:"
	@echo "  make run             - Start the local HTTP development server (Port: $(PORT))"
	@echo ""
	@echo "Examples:"
	@echo "  make run PORT=9000"

run: serve

serve:
	@echo "Starting local HTTP server at: http://localhost:$(PORT)"
	@echo "Press Ctrl+C to stop the server."
	python3 -m http.server $(PORT)
