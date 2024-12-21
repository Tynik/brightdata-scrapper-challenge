export type YahooFinanceStoryTaxonomy = {
  name: string;
  percentChange: string | null;
  href: string;
};

export type YahooFinanceStory = {
  title: string | null;
  content: string | null;
  link: string | null;
  published: {
    where: string | null;
    when: string | null;
  };
  taxonomies: YahooFinanceStoryTaxonomy[];
};

export type YahooFinanceStockIndex = {
  name: string | null;
  price: number | null;
  change: number | null;
  volume: number | null;
  href: string | null;
};

export type YahooFinanceScrappingResult = {
  timestamp: number;
  lastStories: YahooFinanceStory[];
  worldIndices: YahooFinanceStockIndex[];
};
