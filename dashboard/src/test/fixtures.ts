// SYNTHETIC TEST FIXTURES — used only by automated tests. Never imported by the app,
// never shown as anyone's profile.
import type { ChromeVisit } from '../lib/importers'

const DAY = 86_400_000
export const NOW = Date.UTC(2026, 9, 31, 18, 0, 0)

function at(daysAgo: number, hour: number, min = 0) {
  return NOW - daysAgo * DAY + (hour - 18) * 3_600_000 + min * 60_000
}

/** A deterministic synthetic browsing history with known properties the tests assert on. */
export function syntheticHistory(): ChromeVisit[] {
  const v: ChromeVisit[] = []
  for (let d = 0; d < 40; d++) {
    v.push({ url: 'https://github.com/example/repo', title: 'example/repo: a test repository', visitTime: at(d, 10) })
    v.push({ url: 'https://docs.google.com/document/d/abc/edit', title: 'Untitled document', visitTime: at(d, 11) })
    if (d % 2 === 0) v.push({ url: `https://www.youtube.com/watch?v=x${d}`, title: 'Mechanical keyboard review - YouTube', visitTime: at(d, 21) })
    if (d % 3 === 0) v.push({ url: 'https://www.espn.com/nba/', title: 'NBA scores - ESPN', visitTime: at(d, 22) })
  }
  // product research: same keyboard on two retailers within a few days → a price comparison
  v.push({ url: 'https://www.amazon.com/s?k=keychron+k2+keyboard', title: 'Amazon.com : keychron k2 keyboard', visitTime: at(5, 20) })
  v.push({ url: 'https://www.amazon.com/Keychron-Wireless-Mechanical-Keyboard/dp/B07QBPDWLS', title: 'Amazon.com: Keychron K2 Wireless Mechanical Keyboard : Electronics', visitTime: at(5, 20, 5) })
  v.push({ url: 'https://www.amazon.com/Keychron-Wireless-Mechanical-Keyboard/dp/B07QBPDWLS', title: 'Amazon.com: Keychron K2 Wireless Mechanical Keyboard : Electronics', visitTime: at(4, 19) })
  v.push({ url: 'https://www.bestbuy.com/site/searchpage.jsp?st=keychron+k2', title: 'keychron k2 - Best Buy', visitTime: at(4, 19, 10) })
  v.push({ url: 'https://www.google.com/search?q=keychron+k2+vs+logitech+mx+keys+review', title: 'keychron k2 vs logitech mx keys review - Google Search', visitTime: at(4, 19, 20) })
  v.push({ url: 'https://slickdeals.net/f/123-keychron-deal', title: 'Keychron K2 deal $59', visitTime: at(3, 21) })
  for (let i = 0; i < 12; i++) v.push({ url: `https://www.amazon.com/s?k=usb+c+cable+${i}`, title: 'Amazon.com : usb c cable', visitTime: at(i * 2, 13) })
  // sensitive records that must be excluded from all inference
  v.push({ url: 'https://www.webmd.com/diabetes/symptoms', title: 'Diabetes symptoms - WebMD', visitTime: at(2, 23) })
  v.push({ url: 'https://www.google.com/search?q=church+near+me', title: 'church near me - Google Search', visitTime: at(2, 9) })
  v.push({ url: 'https://www.politico.com/news/election', title: 'Election results', visitTime: at(1, 9) })
  // noise that must be dropped
  v.push({ url: 'https://accounts.google.com/signin/v2', title: 'Sign in', visitTime: at(1, 8) })
  v.push({ url: 'http://localhost:5173/', title: 'Local dev', visitTime: at(1, 8) })
  return v
}
