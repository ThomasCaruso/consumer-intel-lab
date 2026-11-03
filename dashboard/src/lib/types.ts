// Core data model. Everything here lives in memory only unless noted otherwise.

export type SourceKind =
  | 'chrome'
  | 'takeout-browser'
  | 'takeout-activity'
  | 'chatgpt'
  | 'orders'
  | 'csv'
  | 'json'

export type RecordKind = 'visit' | 'search' | 'chat' | 'order'

export interface ActivityRecord {
  id: string
  sourceId: string // which import batch this came from
  source: SourceKind
  kind: RecordKind
  time: number // epoch ms
  title: string
  url?: string
  domain?: string
  /** For searches: the query text. For chats: the user's own words only. */
  text?: string
  /** For orders: price paid if present in the export. */
  amount?: number
  transition?: string
}

export interface DataSource {
  id: string
  kind: SourceKind
  label: string
  importedAt: number
  recordCount: number
  skipped: number
  notes: string[]
}

export interface Product {
  id: string
  name: string
  url: string
  retailer: string
  sourceId?: string
  price?: number
  currency?: string
  image?: string
  brand?: string
  category?: string
  /** 'capture' = read from the page's structured data by the extension; 'catalog' = imported file; 'history' = a product page you visited (no price). */
  origin: 'capture' | 'catalog' | 'history'
  capturedAt?: number
  /** Where the price came from, shown verbatim to the user. */
  priceSource?: string
}

export type Confidence = 'High' | 'Medium' | 'Low' | 'INSUFFICIENT DATA'

export interface Evidence {
  recordId: string
  time: number
  title: string
  url?: string
  why: string
}

export interface ScoredItem {
  id: string
  label: string
  score: number // 0..100
  count: number
  days: number
  firstSeen: number
  lastSeen: number
  confidence: Confidence
  evidence: Evidence[]
  observed: string // directly observed facts, in words
  inferred: string // what we infer from them, in words
}

export interface DomainStat {
  domain: string
  visits: number
  days: number
  firstSeen: number
  lastSeen: number
  category: string
  recency: number // 0..1
  repeat: boolean
}

export interface Tendency {
  id: string
  label: string
  low: string
  high: string
  score: number | null // null = INSUFFICIENT DATA
  confidence: Confidence
  signals: { label: string; value: number; weight: number; detail: string }[]
  evidence: Evidence[]
  method: string
  limitations: string
}

export interface Segment {
  id: string
  label: string
  description: string
  score: number
  member: boolean
  confidence: Confidence
  criteria: { label: string; value: number; weight: number }[]
}

export interface GraphNode {
  id: string
  label: string
  type: 'interest' | 'domain' | 'brand' | 'search' | 'product'
  weight: number
  category?: string
  evidence: Evidence[]
  method: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  weight: number
  method: string
  evidence: Evidence[]
}

export interface ShoppingStats {
  retailerVisits: number
  productViews: number
  cartEvents: number
  orders: number
  productSearches: number
  comparisons: { term: string; retailers: string[]; evidence: Evidence[] }[]
  retailers: { domain: string; visits: number }[]
  dealSignals: number
  reviewSignals: number
}

export interface Profile {
  generatedAt: number
  totalRecords: number
  analyzedRecords: number
  excludedSensitive: number
  excludedOther: number
  span: { start: number; end: number; days: number; activeDays: number }
  domains: DomainStat[]
  interests: ScoredItem[]
  brands: ScoredItem[]
  searches: { text: string; engine: string; time: number; category: string; recordId: string }[]
  shopping: ShoppingStats
  hourByWeekday: number[][] // [7][24]
  daily: Record<string, number> // YYYY-MM-DD -> count
  categoryFlows: { from: string; to: string; count: number }[]
  repeatShare: number
  exploratoryShare: number
  interestTrend: { id: string; label: string; first: number; second: number; change: number }[]
  weekly: { week: string; byCategory: Record<string, number> }[]
  tendencies: Tendency[]
  segments: Segment[]
  graph: { nodes: GraphNode[]; edges: GraphEdge[] }
  historyProducts: Product[]
}

export type Verdict = 'accurate' | 'inaccurate' | 'uncertain'

export interface Feedback {
  verdicts: Record<string, Verdict> // key: 'interest:<id>' | 'brand:<id>' | 'tendency:<id>' | 'segment:<id>'
  selfRated: Record<string, number> // interest id -> 0..5
}
