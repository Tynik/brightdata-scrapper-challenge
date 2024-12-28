# Yahoo Finance Scraper

A powerful web scraper that extracts the latest financial news and world stock indices from [Yahoo Finance](https://finance.yahoo.com). 
The scraped data is analyzed using the [OpenAI API](https://openai.com/) to summarize trends and highlight key sentiments. 
Results can be sent to a Telegram bot channel for easy access. The scraper supports scheduling (e.g., hourly runs) and dynamic execution.

---

## Features

- **Dynamic Content Scraping**: Extracts the latest financial news and world stock indices by scrolling through the Yahoo Finance interface.
- **AI-Powered Analysis**: Summarizes trends and evaluates sentiments using OpenAI.
- **Telegram Notifications**: Sends results directly to a Telegram channel.
- **Configurable Scheduling**: Supports cron-like scheduling for periodic scraping.
- **Bright Data Scraping Browser Support**: Integrates with Bright Data for handling CAPTCHAs, IP blocking, and advanced scraping scenarios.

---

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- A package manager (preferably `pnpm`)
- Optional: Access to OpenAI API and Telegram Bot Token
- Optional: Bright Data Scraping Browser for advanced scraping

### Installation
   
1. Install dependencies: `pnpm install`.
2. Set up environment variables in a `.env` or `.env.local` file.
3. Run the Scraper: `pnpm start`.

## Bright Data Integration

This project supports the Bright Data Scraping Browser for advanced scraping needs, such as resolving CAPTCHAs or bypassing IP blocking. 
When `BROWSER_WS` is set in `.env` or `.env.local` file, the scraper connects to a remote browser instance.

### Limitations

- **Performance**: Slower compared to local browser scraping.
- **Debugging Complexity**: Remote browser debugging requires additional effort to understand issues under the hood.

### Improvements

A retry system has been implemented to handle connection interruptions, but in some cases, additional debugging may be required to ensure stable operation.

## Logs and Debugging

Logs are output to the console during scraping, including:

- Configuration details.
- Progress for each scraping iteration.
- Errors or interruptions.

## Known Issues

- **Inconsistencies**: The remote browser sometimes fails to load the latest Yahoo Finance news, while the local instance works without issue.
- **Navigation Limits**: Opening too many tabs may trigger navigation limits.
- **Debugging Challenges**: Debugging remote instances of the Bright Data Scraping Browser can be complex and time-consuming.

## Contributions

Contributions, issues, and feature requests are welcome! Feel free to fork the repository and submit a pull request.

## Contact

If you have any questions or need assistance, please reach out via [m.aliynik@gmail.com](mailto:m.aliynik@gmail.com) or open an issue on GitHub.

Let me know if you'd like further customization or additions!