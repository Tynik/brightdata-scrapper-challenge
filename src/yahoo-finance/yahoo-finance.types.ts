export type YahooFinanceLastStoryTaxonomy = {
  name: string;
  percentChange: string | null;
  link: string;
};

export type YahooFinanceLastStory = {
  title: string | null;
  content: string | null;
  link: string | null;
  published: {
    where: string | null;
    when: string | null;
  };
  taxonomies: YahooFinanceLastStoryTaxonomy[];
};

export type YahooFinanceScrappingResult = {
  timestamp: number;
  lastStories: YahooFinanceLastStory[];
};
