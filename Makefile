# --- KalimaCards Developer Makefile ---

.PHONY: help run serve parse

# Default port for the local server
PORT ?= 8000

# Default CSV file path for the parser
CSV ?= corpus_data.csv

help:
	@echo "KalimaCards Development Commands:"
	@echo "  make run             - Start the local HTTP development server (Port: $(PORT))"
	@echo "  make parse CSV=path  - Parse a CSV dataset and compile to words.json"
	@echo ""
	@echo "Examples:"
	@echo "  make run PORT=9000"
	@echo "  make parse CSV=scripts/sample_data.csv"

run: serve

serve:
	@echo "Starting local HTTP server at: http://localhost:$(PORT)"
	@echo "Press Ctrl+C to stop the server."
	python3 -m http.server $(PORT)

parse:
	@if [ ! -f "$(CSV)" ]; then \
		echo "Error: File '$(CSV)' does not exist."; \
		echo "Usage: make parse CSV=<path_to_csv_file>"; \
		exit 1; \
	fi
	python3 scripts/parse_corpus.py $(CSV)
