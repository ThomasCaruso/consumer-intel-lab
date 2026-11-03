// Transparent, hand-written classification rules. Every match is explainable:
// a record is classified by (1) its domain, then (2) keywords in its title / query.

export interface Category {
  id: string
  label: string
  color: string
  domains: string[]
  keywords: string[]
}

export const CATEGORIES: Category[] = [
  {
    id: 'tech', label: 'Tech & Electronics', color: '#5ee6d0',
    domains: ['bestbuy.com', 'newegg.com', 'bhphotovideo.com', 'theverge.com', 'engadget.com', 'gsmarena.com', 'rtings.com', 'tomshardware.com', 'anandtech.com', 'arstechnica.com', 'microcenter.com', 'apple.com', 'samsung.com', 'dell.com', 'lenovo.com', 'logitech.com', 'pcpartpicker.com', 'wired.com', 'cnet.com', 'techradar.com', '9to5mac.com', 'macrumors.com'],
    keywords: ['laptop', 'iphone', 'android', 'headphones', 'earbuds', 'monitor', 'keyboard', 'mouse', 'gpu', 'graphics card', 'cpu', 'ssd', 'tablet', 'ipad', 'macbook', 'smartwatch', 'camera', 'tv ', 'television', 'charger', 'usb-c', 'speaker', 'router', 'airpods', 'pixel'],
  },
  {
    id: 'dev', label: 'Software & Coding', color: '#7aa2ff',
    domains: ['github.com', 'stackoverflow.com', 'gitlab.com', 'npmjs.com', 'pypi.org', 'developer.mozilla.org', 'vercel.com', 'netlify.com', 'docs.python.org', 'react.dev', 'vitejs.dev', 'typescriptlang.org', 'supabase.com', 'render.com', 'railway.app', 'cloudflare.com', 'aws.amazon.com', 'console.cloud.google.com', 'dev.to', 'medium.com', 'hackernews.com', 'news.ycombinator.com', 'stackexchange.com', 'learn.microsoft.com', 'expo.dev', 'docker.com'],
    keywords: ['javascript', 'typescript', 'python', 'react', 'api', 'npm', 'github', 'error:', 'exception', 'deploy', 'docker', 'sql', 'postgres', 'node.js', 'framework', 'repository', 'pull request', 'stack overflow'],
  },
  {
    id: 'ai', label: 'AI & Data', color: '#a78bfa',
    domains: ['chatgpt.com', 'chat.openai.com', 'openai.com', 'claude.ai', 'anthropic.com', 'gemini.google.com', 'perplexity.ai', 'huggingface.co', 'kaggle.com', 'midjourney.com', 'runwayml.com', 'elevenlabs.io', 'higgsfield.ai', 'replicate.com', 'fal.ai', 'arxiv.org', 'paperswithcode.com', 'notebooklm.google.com', 'copilot.microsoft.com', 'deepseek.com', 'x.ai', 'grok.com', 'cursor.com', 'kling.ai', 'lmarena.ai'],
    keywords: ['ai ', ' ai', 'llm', 'gpt', 'claude', 'machine learning', 'neural', 'prompt', 'chatbot', 'dataset', 'data science', 'model', 'agent', 'openai', 'gemini', 'diffusion'],
  },
  {
    id: 'finance', label: 'Finance & Investing', color: '#ffb547',
    domains: ['robinhood.com', 'fidelity.com', 'schwab.com', 'vanguard.com', 'etrade.com', 'webull.com', 'finance.yahoo.com', 'bloomberg.com', 'wsj.com', 'marketwatch.com', 'seekingalpha.com', 'investopedia.com', 'morningstar.com', 'cnbc.com', 'tradingview.com', 'coinbase.com', 'binance.com', 'macrotrends.net', 'sec.gov', 'ft.com', 'barrons.com', 'stockanalysis.com', 'nerdwallet.com', 'chase.com', 'bankofamerica.com', 'venmo.com', 'paypal.com', 'cfainstitute.org'],
    keywords: ['stock', 'stocks', 'etf', 'invest', 'dividend', 'portfolio', 'earnings', 'valuation', 'dcf', 'crypto', 'bitcoin', 'interest rate', 'credit card', 'budget', '10-k', 'market cap', 'cfa', 'capm'],
  },
  {
    id: 'fashion', label: 'Fashion & Apparel', color: '#ff6b8b',
    domains: ['nike.com', 'adidas.com', 'zara.com', 'hm.com', 'uniqlo.com', 'asos.com', 'nordstrom.com', 'macys.com', 'shein.com', 'gap.com', 'oldnavy.gap.com', 'lululemon.com', 'stockx.com', 'goat.com', 'ssense.com', 'farfetch.com', 'urbanoutfitters.com', 'abercrombie.com', 'ae.com', 'jcrew.com', 'patagonia.com', 'thenorthface.com', 'newbalance.com', 'footlocker.com', 'ralphlauren.com', 'grailed.com', 'depop.com', 'poshmark.com'],
    keywords: ['sneakers', 'shoes', 'jacket', 'hoodie', 'jeans', 'shirt', 'dress', 'outfit', 'streetwear', 'apparel', 'boots', 'watch band', 'sunglasses'],
  },
  {
    id: 'beauty', label: 'Beauty & Grooming', color: '#f9a8d4',
    domains: ['sephora.com', 'ulta.com', 'glossier.com', 'theordinary.com', 'fentybeauty.com', 'dollarshaveclub.com', 'harrys.com'],
    keywords: ['skincare', 'moisturizer', 'cologne', 'perfume', 'fragrance', 'makeup', 'shampoo', 'razor', 'sunscreen', 'serum', 'grooming'],
  },
  {
    id: 'home', label: 'Home & Living', color: '#86efac',
    domains: ['ikea.com', 'wayfair.com', 'homedepot.com', 'lowes.com', 'crateandbarrel.com', 'westelm.com', 'potterybarn.com', 'zillow.com', 'apartments.com', 'redfin.com', 'realtor.com', 'containerstore.com', 'bedbathandbeyond.com'],
    keywords: ['furniture', 'sofa', 'desk', 'chair', 'mattress', 'kitchen', 'apartment', 'decor', 'lamp', 'vacuum', 'cookware', 'storage', 'rent'],
  },
  {
    id: 'food', label: 'Food & Dining', color: '#fdba74',
    domains: ['doordash.com', 'ubereats.com', 'grubhub.com', 'instacart.com', 'allrecipes.com', 'seriouseats.com', 'bonappetit.com', 'yelp.com', 'opentable.com', 'chipotle.com', 'starbucks.com', 'dominos.com', 'hellofresh.com', 'nytimes.com/cooking', 'tasty.co', 'mcdonalds.com', 'wholefoodsmarket.com', 'traderjoes.com'],
    keywords: ['recipe', 'restaurant', 'delivery', 'menu', 'pizza', 'coffee', 'sushi', 'burger', 'dinner', 'lunch', 'cooking', 'grocery'],
  },
  {
    id: 'travel', label: 'Travel', color: '#67e8f9',
    domains: ['booking.com', 'expedia.com', 'airbnb.com', 'kayak.com', 'google.com/travel', 'tripadvisor.com', 'hotels.com', 'delta.com', 'united.com', 'aa.com', 'southwest.com', 'jetblue.com', 'skyscanner.com', 'amtrak.com', 'marriott.com', 'hilton.com', 'vrbo.com', 'uber.com', 'lyft.com'],
    keywords: ['flight', 'flights', 'hotel', 'airbnb', 'trip', 'vacation', 'itinerary', 'passport', 'airport', 'travel'],
  },
  {
    id: 'sports', label: 'Sports & Outdoors', color: '#4ade80',
    domains: ['espn.com', 'nba.com', 'nfl.com', 'mlb.com', 'nhl.com', 'theathletic.com', 'bleacherreport.com', 'rei.com', 'dickssportinggoods.com', 'strava.com', 'fanduel.com', 'draftkings.com', 'premierleague.com', 'ufc.com', 'si.com', 'hudl.com', 'usaultimate.org', 'ultiworld.com'],
    keywords: ['nba', 'nfl', 'mlb', 'soccer', 'football', 'basketball', 'baseball', 'hockey', 'golf', 'tennis', 'workout', 'gym', 'running', 'hiking', 'camping', 'ultimate frisbee', 'game score', 'playoffs', 'fantasy'],
  },
  {
    id: 'gaming', label: 'Gaming', color: '#c084fc',
    domains: ['store.steampowered.com', 'steamcommunity.com', 'twitch.tv', 'epicgames.com', 'playstation.com', 'xbox.com', 'nintendo.com', 'ign.com', 'gamespot.com', 'pcgamer.com', 'roblox.com', 'chess.com', 'lichess.org', 'itch.io', 'riotgames.com', 'minecraft.net'],
    keywords: ['gameplay', 'video game', 'steam', 'ps5', 'xbox', 'nintendo switch', 'esports', 'walkthrough', 'speedrun', 'patch notes', 'roblox', 'minecraft', 'fortnite'],
  },
  {
    id: 'entertainment', label: 'Streaming & Entertainment', color: '#f472b6',
    domains: ['youtube.com', 'netflix.com', 'hulu.com', 'disneyplus.com', 'max.com', 'primevideo.com', 'tv.apple.com', 'peacocktv.com', 'paramountplus.com', 'imdb.com', 'rottentomatoes.com', 'letterboxd.com', 'crunchyroll.com', 'tiktok.com', 'fandom.com', 'ticketmaster.com'],
    keywords: ['trailer', 'episode', 'season', 'movie', 'film', 'show', 'watch', 'anime', 'concert', 'tickets', 'podcast'],
  },
  {
    id: 'music', label: 'Music', color: '#fb7185',
    domains: ['spotify.com', 'open.spotify.com', 'music.apple.com', 'soundcloud.com', 'genius.com', 'bandcamp.com', 'music.youtube.com', 'pitchfork.com', 'tidal.com'],
    keywords: ['lyrics', 'album', 'playlist', 'song', 'tour', 'vinyl', 'remix'],
  },
  {
    id: 'social', label: 'Social & Community', color: '#60a5fa',
    domains: ['instagram.com', 'facebook.com', 'x.com', 'twitter.com', 'reddit.com', 'linkedin.com', 'snapchat.com', 'pinterest.com', 'discord.com', 'threads.net', 'bsky.app', 'quora.com', 'messenger.com', 'web.whatsapp.com', 'groupme.com'],
    keywords: ['reddit', 'subreddit', 'thread', 'followers', 'post'],
  },
  {
    id: 'news', label: 'News & Media', color: '#94a3b8',
    domains: ['nytimes.com', 'cnn.com', 'bbc.com', 'bbc.co.uk', 'reuters.com', 'apnews.com', 'theguardian.com', 'washingtonpost.com', 'npr.org', 'axios.com', 'news.google.com', 'businessinsider.com', 'forbes.com', 'theatlantic.com', 'vox.com', 'usatoday.com', 'techcrunch.com', 'substack.com'],
    keywords: ['breaking', 'news', 'report', 'analysis', 'opinion'],
  },
  {
    id: 'learning', label: 'Learning & School', color: '#facc15',
    domains: ['coursera.org', 'edx.org', 'udemy.com', 'khanacademy.org', 'quizlet.com', 'chegg.com', 'duolingo.com', 'wikipedia.org', 'en.wikipedia.org', 'brilliant.org', 'scholar.google.com', 'jstor.org', 'instructure.com', 'canvas.instructure.com', 'blackboard.com', 'brightspace.com', 'd2l.com', 'gradescope.com', 'mheducation.com', 'pearson.com', 'wiley.com', 'cengage.com', 'studocu.com', 'coursehero.com', 'libguides.com'],
    keywords: ['lecture', 'homework', 'assignment', 'syllabus', 'course', 'exam', 'quiz', 'tutorial', 'how to', 'textbook', 'study', 'professor', 'class', 'chapter'],
  },
  {
    id: 'careers', label: 'Careers & Jobs', color: '#2dd4bf',
    domains: ['linkedin.com/jobs', 'indeed.com', 'glassdoor.com', 'handshake.com', 'joinhandshake.com', 'levels.fyi', 'lever.co', 'jobs.lever.co', 'greenhouse.io', 'boards.greenhouse.io', 'myworkdayjobs.com', 'workday.com', 'ziprecruiter.com', 'wellfound.com', 'simplify.jobs', 'ycombinator.com/jobs'],
    keywords: ['internship', 'resume', 'cover letter', 'job', 'jobs', 'interview', 'hiring', 'career', 'salary', 'recruiter', 'application'],
  },
  {
    id: 'productivity', label: 'Productivity & Work Tools', color: '#a3e635',
    domains: ['docs.google.com', 'drive.google.com', 'mail.google.com', 'calendar.google.com', 'notion.so', 'notion.com', 'outlook.office.com', 'outlook.live.com', 'office.com', 'microsoft365.com', 'slack.com', 'zoom.us', 'trello.com', 'asana.com', 'figma.com', 'canva.com', 'dropbox.com', 'airtable.com', 'miro.com', 'loom.com', 'calendly.com', 'onedrive.live.com', 'sharepoint.com', 'teams.microsoft.com'],
    keywords: ['spreadsheet', 'slides', 'meeting', 'calendar', 'presentation', 'document', 'inbox'],
  },
  {
    id: 'design', label: 'Art, Design & Creativity', color: '#e879f9',
    domains: ['dribbble.com', 'behance.net', 'artstation.com', 'adobe.com', 'unsplash.com', 'coolors.co', 'fonts.google.com', 'awwwards.com', 'blender.org', 'procreate.com', 'deviantart.com'],
    keywords: ['design', 'logo', 'typography', 'font', 'illustration', 'photography', 'figma', 'animation', '3d', 'video editing', 'premiere', 'after effects', 'branding'],
  },
  {
    id: 'auto', label: 'Automotive', color: '#fca5a5',
    domains: ['cars.com', 'carmax.com', 'carvana.com', 'autotrader.com', 'edmunds.com', 'kbb.com', 'caranddriver.com', 'motortrend.com', 'tesla.com', 'toyota.com', 'honda.com', 'ford.com', 'bmwusa.com'],
    keywords: ['car ', 'cars', 'suv', 'sedan', 'electric vehicle', 'tesla', 'mpg', 'dealership', 'tires', 'oil change'],
  },
  {
    id: 'books', label: 'Books & Reading', color: '#d6d3d1',
    domains: ['goodreads.com', 'audible.com', 'bookshop.org', 'barnesandnoble.com', 'libbyapp.com', 'kindle.amazon.com', 'gutenberg.org'],
    keywords: ['book', 'novel', 'author', 'kindle', 'audiobook', 'paperback'],
  },
  {
    id: 'shopping', label: 'General Shopping', color: '#fde68a',
    domains: ['amazon.com', 'walmart.com', 'target.com', 'ebay.com', 'etsy.com', 'costco.com', 'temu.com', 'aliexpress.com', 'samsclub.com', 'kohls.com', 'overstock.com', 'wish.com', 'shopify.com', 'shop.app', 'slickdeals.net', 'camelcamelcamel.com', 'honey.com', 'rakuten.com', 'retailmenot.com'],
    keywords: ['deal', 'deals', 'coupon', 'discount', 'sale', 'buy', 'price', 'cheap', 'best ', 'review', 'gift'],
  },
]

export const CATEGORY_BY_ID: Record<string, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))
export const OTHER = { id: 'other', label: 'Uncategorized', color: '#64748b' }

export function categoryLabel(id: string) {
  return CATEGORY_BY_ID[id]?.label ?? OTHER.label
}
export function categoryColor(id: string) {
  return CATEGORY_BY_ID[id]?.color ?? OTHER.color
}

// ---------------------------------------------------------------------------
// Sensitive categories. Records that match these are EXCLUDED from every
// inference (not just hidden) so the dashboard cannot reveal or imply health
// conditions, religion, political beliefs, or sexuality.
// ---------------------------------------------------------------------------
export const SENSITIVE = {
  domains: [
    'webmd.com', 'mayoclinic.org', 'healthline.com', 'nih.gov', 'medlineplus.gov', 'clevelandclinic.org', 'drugs.com', 'goodrx.com', 'psychologytoday.com', 'betterhelp.com', 'talkspace.com', 'plannedparenthood.org', 'mychart.com', 'patientportal', 'zocdoc.com', 'cvs.com', 'walgreens.com', 'teladoc.com', 'hims.com', 'hers.com', 'ro.co', 'verywellhealth.com', 'medicalnewstoday.com',
    'biblegateway.com', 'bible.com', 'quran.com', 'churchofjesuschrist.org', 'chabad.org', 'vatican.va', 'jw.org', 'sefaria.org',
    'democrats.org', 'gop.com', 'actblue.com', 'winred.com', 'whitehouse.gov', 'congress.gov', 'ballotpedia.org', 'fivethirtyeight.com', 'realclearpolitics.com', 'politico.com', 'thehill.com', 'foxnews.com', 'msnbc.com', 'breitbart.com', 'dailywire.com',
    'pornhub.com', 'xvideos.com', 'onlyfans.com', 'grindr.com', 'tinder.com', 'hinge.co', 'bumble.com', 'okcupid.com', 'match.com', 'chaturbate.com', 'xhamster.com', 'reddit.com/r/nsfw',
  ],
  keywords: [
    'symptom', 'diagnosis', 'diagnosed', 'disease', 'disorder', 'medication', 'prescription', 'pregnan', 'cancer', 'diabetes', 'depression', 'anxiety', 'adhd', 'therapy', 'therapist', 'std', 'hiv', 'covid test', 'side effects', 'dosage', 'clinic', 'doctor', 'pharmacy', 'mental health', 'rehab', 'weight loss drug', 'ozempic',
    'church', 'mosque', 'synagogue', 'temple', 'bible', 'quran', 'torah', 'prayer', 'religion', 'religious', 'christian', 'muslim', 'jewish', 'hindu', 'buddhis', 'atheis', 'catholic', 'mormon',
    'democrat', 'republican', 'liberal', 'conservative', 'election', 'campaign', 'trump', 'biden', 'harris', 'vance', 'congress', 'senate', 'ballot', 'vote ', 'voting', 'abortion', 'immigration policy', 'political', 'politics', 'protest',
    'gay', 'lesbian', 'bisexual', 'transgender', 'lgbt', 'queer', 'sexual', 'porn', 'nsfw', 'onlyfans', 'dating app', 'hookup', 'sexuality',
  ],
}

// Pages that carry no consumer meaning or might hold credentials.
const NOISE_PATTERNS = [
  /^chrome(-extension)?:/, /^about:/, /^file:/, /^edge:/, /^devtools:/,
  /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.)/,
  /(login|signin|sign-in|logout|oauth|auth\/|sso|password|2fa|verify|accounts\.google\.com)/i,
]

export function isNoise(url: string | undefined) {
  if (!url) return false
  return NOISE_PATTERNS.some((p) => p.test(url))
}

// ---------------------------------------------------------------------------
// Brands. Matched as whole words in titles/queries, or by owned domain.
// tier: 'premium' | 'value' | 'mid' feeds the premium-vs-value tendency.
// ---------------------------------------------------------------------------
export interface Brand { name: string; domains: string[]; category: string; tier: 'premium' | 'value' | 'mid'; aliases?: string[] }

export const BRANDS: Brand[] = [
  { name: 'Apple', domains: ['apple.com'], category: 'tech', tier: 'premium', aliases: ['iphone', 'macbook', 'airpods', 'ipad'] },
  { name: 'Samsung', domains: ['samsung.com'], category: 'tech', tier: 'mid', aliases: ['galaxy'] },
  { name: 'Google', domains: ['store.google.com'], category: 'tech', tier: 'mid', aliases: ['pixel'] },
  { name: 'Sony', domains: ['sony.com'], category: 'tech', tier: 'premium' },
  { name: 'Bose', domains: ['bose.com'], category: 'tech', tier: 'premium' },
  { name: 'Logitech', domains: ['logitech.com', 'logitechg.com'], category: 'tech', tier: 'mid' },
  { name: 'Dell', domains: ['dell.com'], category: 'tech', tier: 'mid' },
  { name: 'Lenovo', domains: ['lenovo.com'], category: 'tech', tier: 'mid' },
  { name: 'HP', domains: ['hp.com'], category: 'tech', tier: 'mid' },
  { name: 'Asus', domains: ['asus.com'], category: 'tech', tier: 'mid' },
  { name: 'Razer', domains: ['razer.com'], category: 'gaming', tier: 'premium' },
  { name: 'Nvidia', domains: ['nvidia.com'], category: 'tech', tier: 'premium' },
  { name: 'Anker', domains: ['anker.com'], category: 'tech', tier: 'value' },
  { name: 'Microsoft', domains: ['microsoft.com'], category: 'tech', tier: 'mid', aliases: ['surface'] },
  { name: 'Tesla', domains: ['tesla.com'], category: 'auto', tier: 'premium' },
  { name: 'Toyota', domains: ['toyota.com'], category: 'auto', tier: 'mid' },
  { name: 'Honda', domains: ['honda.com'], category: 'auto', tier: 'mid' },
  { name: 'Nike', domains: ['nike.com'], category: 'fashion', tier: 'mid', aliases: ['jordan'] },
  { name: 'Adidas', domains: ['adidas.com'], category: 'fashion', tier: 'mid' },
  { name: 'New Balance', domains: ['newbalance.com'], category: 'fashion', tier: 'mid' },
  { name: 'Lululemon', domains: ['lululemon.com'], category: 'fashion', tier: 'premium' },
  { name: 'Patagonia', domains: ['patagonia.com'], category: 'fashion', tier: 'premium' },
  { name: 'The North Face', domains: ['thenorthface.com'], category: 'fashion', tier: 'premium' },
  { name: 'Uniqlo', domains: ['uniqlo.com'], category: 'fashion', tier: 'value' },
  { name: 'Zara', domains: ['zara.com'], category: 'fashion', tier: 'mid' },
  { name: 'H&M', domains: ['hm.com'], category: 'fashion', tier: 'value' },
  { name: 'Shein', domains: ['shein.com'], category: 'fashion', tier: 'value' },
  { name: 'Ralph Lauren', domains: ['ralphlauren.com'], category: 'fashion', tier: 'premium' },
  { name: 'Gucci', domains: ['gucci.com'], category: 'fashion', tier: 'premium' },
  { name: 'Rolex', domains: ['rolex.com'], category: 'fashion', tier: 'premium' },
  { name: 'Sephora', domains: ['sephora.com'], category: 'beauty', tier: 'premium' },
  { name: 'Ulta', domains: ['ulta.com'], category: 'beauty', tier: 'mid' },
  { name: 'IKEA', domains: ['ikea.com'], category: 'home', tier: 'value' },
  { name: 'Dyson', domains: ['dyson.com'], category: 'home', tier: 'premium' },
  { name: 'Starbucks', domains: ['starbucks.com'], category: 'food', tier: 'mid' },
  { name: 'Chipotle', domains: ['chipotle.com'], category: 'food', tier: 'mid' },
  { name: 'Amazon', domains: ['amazon.com'], category: 'shopping', tier: 'mid', aliases: ['kindle', 'alexa', 'echo dot'] },
  { name: 'Walmart', domains: ['walmart.com'], category: 'shopping', tier: 'value' },
  { name: 'Target', domains: ['target.com'], category: 'shopping', tier: 'mid' },
  { name: 'Costco', domains: ['costco.com'], category: 'shopping', tier: 'value' },
  { name: 'Temu', domains: ['temu.com'], category: 'shopping', tier: 'value' },
  { name: 'Spotify', domains: ['spotify.com', 'open.spotify.com'], category: 'music', tier: 'mid' },
  { name: 'Netflix', domains: ['netflix.com'], category: 'entertainment', tier: 'mid' },
  { name: 'Disney', domains: ['disneyplus.com', 'disney.com'], category: 'entertainment', tier: 'mid' },
  { name: 'PlayStation', domains: ['playstation.com'], category: 'gaming', tier: 'mid', aliases: ['ps5'] },
  { name: 'Xbox', domains: ['xbox.com'], category: 'gaming', tier: 'mid' },
  { name: 'Nintendo', domains: ['nintendo.com'], category: 'gaming', tier: 'mid' },
  { name: 'Steam', domains: ['store.steampowered.com', 'steamcommunity.com'], category: 'gaming', tier: 'mid' },
  { name: 'OpenAI', domains: ['openai.com', 'chatgpt.com', 'chat.openai.com'], category: 'ai', tier: 'mid', aliases: ['chatgpt'] },
  { name: 'Anthropic', domains: ['anthropic.com', 'claude.ai'], category: 'ai', tier: 'mid', aliases: ['claude'] },
  { name: 'Adobe', domains: ['adobe.com'], category: 'design', tier: 'premium', aliases: ['photoshop', 'premiere pro', 'illustrator'] },
  { name: 'Canva', domains: ['canva.com'], category: 'design', tier: 'value' },
  { name: 'Figma', domains: ['figma.com'], category: 'design', tier: 'mid' },
  { name: 'Notion', domains: ['notion.so', 'notion.com'], category: 'productivity', tier: 'mid' },
  { name: 'Robinhood', domains: ['robinhood.com'], category: 'finance', tier: 'value' },
  { name: 'Fidelity', domains: ['fidelity.com'], category: 'finance', tier: 'mid' },
  { name: 'Vanguard', domains: ['vanguard.com'], category: 'finance', tier: 'value' },
  { name: 'Coinbase', domains: ['coinbase.com'], category: 'finance', tier: 'mid' },
  { name: 'Bloomberg', domains: ['bloomberg.com'], category: 'finance', tier: 'premium' },
  { name: 'Uber', domains: ['uber.com', 'ubereats.com'], category: 'travel', tier: 'mid' },
  { name: 'DoorDash', domains: ['doordash.com'], category: 'food', tier: 'mid' },
  { name: 'Airbnb', domains: ['airbnb.com'], category: 'travel', tier: 'mid' },
  { name: 'Delta', domains: ['delta.com'], category: 'travel', tier: 'premium' },
  { name: 'Southwest', domains: ['southwest.com'], category: 'travel', tier: 'value' },
  { name: 'Yeti', domains: ['yeti.com'], category: 'sports', tier: 'premium' },
  { name: 'Stanley', domains: ['stanley1913.com'], category: 'home', tier: 'mid' },
  { name: 'Garmin', domains: ['garmin.com'], category: 'tech', tier: 'premium' },
  { name: 'GoPro', domains: ['gopro.com'], category: 'tech', tier: 'mid' },
  { name: 'Canon', domains: ['canon.com', 'usa.canon.com'], category: 'tech', tier: 'mid' },
  { name: 'Nikon', domains: ['nikonusa.com'], category: 'tech', tier: 'mid' },
  { name: 'DJI', domains: ['dji.com'], category: 'tech', tier: 'premium' },
]

// ---------------------------------------------------------------------------
// Retailers & URL patterns for shopping behavior.
// ---------------------------------------------------------------------------
export const RETAILERS: Record<string, { name: string; tier: 'premium' | 'value' | 'mid'; oneStop?: boolean }> = {
  'amazon.com': { name: 'Amazon', tier: 'mid', oneStop: true },
  'walmart.com': { name: 'Walmart', tier: 'value', oneStop: true },
  'target.com': { name: 'Target', tier: 'mid', oneStop: true },
  'bestbuy.com': { name: 'Best Buy', tier: 'mid' },
  'ebay.com': { name: 'eBay', tier: 'value' },
  'etsy.com': { name: 'Etsy', tier: 'mid' },
  'costco.com': { name: 'Costco', tier: 'value', oneStop: true },
  'samsclub.com': { name: "Sam's Club", tier: 'value', oneStop: true },
  'temu.com': { name: 'Temu', tier: 'value' },
  'aliexpress.com': { name: 'AliExpress', tier: 'value' },
  'shein.com': { name: 'Shein', tier: 'value' },
  'newegg.com': { name: 'Newegg', tier: 'mid' },
  'bhphotovideo.com': { name: 'B&H', tier: 'mid' },
  'homedepot.com': { name: 'Home Depot', tier: 'mid' },
  'lowes.com': { name: "Lowe's", tier: 'mid' },
  'wayfair.com': { name: 'Wayfair', tier: 'mid' },
  'ikea.com': { name: 'IKEA', tier: 'value' },
  'nordstrom.com': { name: 'Nordstrom', tier: 'premium' },
  'macys.com': { name: "Macy's", tier: 'mid' },
  'sephora.com': { name: 'Sephora', tier: 'premium' },
  'ulta.com': { name: 'Ulta', tier: 'mid' },
  'ssense.com': { name: 'SSENSE', tier: 'premium' },
  'farfetch.com': { name: 'Farfetch', tier: 'premium' },
  'stockx.com': { name: 'StockX', tier: 'premium' },
  'apple.com': { name: 'Apple Store', tier: 'premium' },
  'nike.com': { name: 'Nike', tier: 'mid' },
  'kohls.com': { name: "Kohl's", tier: 'value' },
  'instacart.com': { name: 'Instacart', tier: 'mid', oneStop: true },
  'doordash.com': { name: 'DoorDash', tier: 'mid', oneStop: true },
  'ubereats.com': { name: 'Uber Eats', tier: 'mid', oneStop: true },
}

export const DEAL_DOMAINS = ['slickdeals.net', 'camelcamelcamel.com', 'honey.com', 'rakuten.com', 'retailmenot.com', 'dealnews.com', 'groupon.com', 'joinhoney.com', 'keepa.com']
export const DEAL_WORDS = /\b(deal|deals|coupon|promo code|discount|cheap|cheapest|budget|under \$?\d+|sale|clearance|price drop|lowest price|on sale|black friday|cyber monday|refurbished|used)\b/i
export const REVIEW_WORDS = /\b(review|reviews|vs\.?|versus|compare|comparison|best|top \d+|worth it|reddit|specs|benchmark|rating|ratings|alternatives?)\b/i
export const CONVENIENCE_WORDS = /\b(same day|same-day|next day|delivery|delivered|pickup|prime|subscribe|subscription|near me|open now|fast shipping|express)\b/i
export const PREMIUM_WORDS = /\b(premium|luxury|pro|ultra|flagship|high[- ]end|designer|limited edition)\b/i

/** Retailer product-page URL shapes (no fetching — URL pattern only). */
export function isProductPage(domain: string, url: string) {
  try {
    const u = new URL(url)
    const p = u.pathname
    if (domain === 'amazon.com') return /\/(dp|gp\/product)\/[A-Z0-9]{10}/.test(p)
    if (domain === 'walmart.com') return /^\/ip\//.test(p)
    if (domain === 'target.com') return /^\/p\//.test(p)
    if (domain === 'bestbuy.com') return /\/site\/.+\.p$/.test(p) || u.searchParams.has('skuId')
    if (domain === 'ebay.com') return /^\/itm\//.test(p)
    if (domain === 'etsy.com') return /^\/listing\//.test(p)
    if (domain === 'newegg.com') return /\/p\//.test(p)
    if (domain === 'costco.com') return /\.product\.\d+\.html$/.test(p)
    if (domain === 'homedepot.com' || domain === 'lowes.com') return /^\/(p|pd)\//.test(p)
    if (domain === 'nike.com') return /^\/t\//.test(p)
    if (domain === 'apple.com') return /^\/shop\/buy-/.test(p)
    if (RETAILERS[domain]) return /\/(product|products|p|item|dp)\//.test(p)
    return false
  } catch {
    return false
  }
}

export function isCartPage(url: string) {
  return /\/(cart|basket|checkout|bag|buy\/)/i.test(url)
}

/** Pull the search query out of known search-engine / retailer search URLs. */
const SEARCH_PARAMS: { host: RegExp; path?: RegExp; param: string; engine: string }[] = [
  { host: /(^|\.)google\.[a-z.]+$/, path: /^\/search/, param: 'q', engine: 'Google' },
  { host: /(^|\.)bing\.com$/, path: /^\/search/, param: 'q', engine: 'Bing' },
  { host: /(^|\.)duckduckgo\.com$/, param: 'q', engine: 'DuckDuckGo' },
  { host: /(^|\.)search\.yahoo\.com$/, param: 'p', engine: 'Yahoo' },
  { host: /(^|\.)perplexity\.ai$/, path: /^\/search/, param: 'q', engine: 'Perplexity' },
  { host: /(^|\.)youtube\.com$/, path: /^\/results/, param: 'search_query', engine: 'YouTube' },
  { host: /(^|\.)amazon\.com$/, path: /^\/s/, param: 'k', engine: 'Amazon' },
  { host: /(^|\.)walmart\.com$/, path: /^\/search/, param: 'q', engine: 'Walmart' },
  { host: /(^|\.)target\.com$/, path: /^\/s/, param: 'searchTerm', engine: 'Target' },
  { host: /(^|\.)bestbuy\.com$/, path: /searchpage/, param: 'st', engine: 'Best Buy' },
  { host: /(^|\.)ebay\.com$/, path: /^\/sch/, param: '_nkw', engine: 'eBay' },
  { host: /(^|\.)etsy\.com$/, path: /^\/search/, param: 'q', engine: 'Etsy' },
  { host: /(^|\.)reddit\.com$/, path: /search/, param: 'q', engine: 'Reddit' },
]

export const RETAIL_ENGINES = new Set(['Amazon', 'Walmart', 'Target', 'Best Buy', 'eBay', 'Etsy'])

export function extractSearch(url: string): { query: string; engine: string } | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    for (const s of SEARCH_PARAMS) {
      if (!s.host.test(host)) continue
      if (s.path && !s.path.test(u.pathname)) continue
      const q = u.searchParams.get(s.param)
      if (q && q.trim()) return { query: q.trim().slice(0, 200), engine: s.engine }
    }
  } catch {
    /* not a URL */
  }
  return null
}

export function domainOf(url: string): string | undefined {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\d?\./, '')
    return h || undefined
  } catch {
    return undefined
  }
}

/** Collapse subdomains to a registrable-ish root (m.youtube.com -> youtube.com), keeping known multi-part hosts. */
export function rootDomain(host: string) {
  const parts = host.split('.')
  if (parts.length <= 2) return host
  const last2 = parts.slice(-2).join('.')
  if (/^(co|com|ac|org|gov)\.[a-z]{2}$/.test(last2)) return parts.slice(-3).join('.')
  return last2
}

function hostMatches(host: string, path: string, candidate: string) {
  const [cHost, ...cPath] = candidate.split('/')
  const okHost = host === cHost || host.endsWith('.' + cHost)
  if (!okHost) return false
  if (cPath.length === 0) return true
  return path.startsWith('/' + cPath.join('/'))
}

const wordCache = new Map<string, RegExp>()
function wordRe(word: string) {
  let re = wordCache.get(word)
  if (!re) {
    const w = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    re = new RegExp(`(^|[^a-z0-9])${w}($|[^a-z0-9])`, 'i')
    wordCache.set(word, re)
  }
  return re
}
export function containsWord(text: string, word: string) {
  return wordRe(word).test(text)
}

export function isSensitive(url: string | undefined, text: string): boolean {
  const t = text.toLowerCase()
  if (url) {
    try {
      const u = new URL(url)
      const host = u.hostname.replace(/^www\./, '')
      if (SENSITIVE.domains.some((d) => hostMatches(host, u.pathname, d))) return true
    } catch {
      /* ignore */
    }
  }
  return SENSITIVE.keywords.some((k) => (k.length <= 4 ? containsWord(t, k) : t.includes(k)))
}

export interface Classification { category: string; rule: string }

/** Classify one record. Domain rules win over keyword rules; the matched rule is returned for explainability. */
export function classify(url: string | undefined, text: string): Classification {
  if (url) {
    try {
      const u = new URL(url)
      const host = u.hostname.replace(/^www\./, '')
      // Prefer the most specific (longest) domain rule, e.g. linkedin.com/jobs over linkedin.com
      let best: { cat: string; d: string } | null = null
      for (const c of CATEGORIES) {
        for (const d of c.domains) {
          if (hostMatches(host, u.pathname, d) && (!best || d.length > best.d.length)) best = { cat: c.id, d }
        }
      }
      // Search pages and general retailers are classified by what was searched for, when that's more specific.
      const s = extractSearch(url)
      if (s) {
        const kw = classifyText(s.query)
        if (kw) return { category: kw.category, rule: `search query "${s.query}" contains "${kw.word}"` }
      }
      if (best && best.cat !== 'shopping' && best.cat !== 'entertainment' && best.cat !== 'social') {
        return { category: best.cat, rule: `domain ${best.d}` }
      }
      // For general platforms (Amazon, YouTube, Reddit) the page title tells us more than the domain.
      const kw = classifyText(text)
      if (kw && kw.category !== 'shopping') return { category: kw.category, rule: `title contains "${kw.word}" (on ${host})` }
      if (best) return { category: best.cat, rule: `domain ${best.d}` }
    } catch {
      /* fall through */
    }
  }
  const kw = classifyText(text)
  if (kw) return { category: kw.category, rule: `text contains "${kw.word}"` }
  return { category: 'other', rule: 'no rule matched' }
}

function classifyText(text: string): { category: string; word: string } | null {
  const t = ' ' + text.toLowerCase() + ' '
  let best: { category: string; word: string; hits: number } | null = null
  for (const c of CATEGORIES) {
    let hits = 0
    let first = ''
    for (const k of c.keywords) {
      if (k.trim().length <= 3 ? containsWord(t, k) : t.includes(k)) {
        hits++
        if (!first) first = k.trim()
      }
    }
    // general-shopping words are weak; only use them if nothing else matches
    const eff = c.id === 'shopping' ? hits * 0.5 : hits
    if (hits && (!best || eff > best.hits)) best = { category: c.id, word: first, hits: eff }
  }
  return best ? { category: best.category, word: best.word } : null
}

export function findBrands(url: string | undefined, text: string): Brand[] {
  const out: Brand[] = []
  const host = url ? domainOf(url) ?? '' : ''
  for (const b of BRANDS) {
    if (host && b.domains.some((d) => host === d || host.endsWith('.' + d))) {
      out.push(b)
      continue
    }
    const names = [b.name, ...(b.aliases ?? [])]
    if (names.some((n) => containsWord(text, n))) out.push(b)
  }
  return out
}
