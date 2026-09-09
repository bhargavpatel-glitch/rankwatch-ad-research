import { hybridSearchEngine } from './hybridSearchEngine';

interface TestCase {
  query: string;
  expectedKeywordsOrBrand: string[];
  description: string;
}

const TEST_CASES: TestCase[] = [
  {
    query: 'Semrush',
    expectedKeywordsOrBrand: ['Semrush'],
    description: 'Exact brand search should rank Semrush ads at the top'
  },
  {
    query: 'Peec AI',
    expectedKeywordsOrBrand: ['Peec AI'],
    description: 'Exact brand search for Peec AI'
  },
  {
    query: 'AI search',
    expectedKeywordsOrBrand: ['AI Search', 'GEO', 'AEO', 'answer engine'],
    description: 'Concept search for AI search should retrieve GEO/AEO/Answer engine ads'
  },
  {
    query: 'AEO tracking',
    expectedKeywordsOrBrand: ['AEO', 'Answer Engine Optimization', 'Profound'],
    description: 'AEO domain search should retrieve relevant tracking and optimization ads'
  },
  {
    query: 'Enterprise GEO',
    expectedKeywordsOrBrand: ['Enterprise', 'GEO', 'Semrush'],
    description: 'Multi-word conjunction search'
  },
  {
    query: 'Document Ad',
    expectedKeywordsOrBrand: ['Document Ad'],
    description: 'Format search for LinkedIn Document carousel ads'
  },
  {
    query: 'Instagram reel',
    expectedKeywordsOrBrand: ['Instagram', 'Reel'],
    description: 'Platform and format discovery'
  }
];

export function runRelevanceBenchmark(): boolean {
  console.log('====================================================');
  console.log('🔬 RUNNING SEARCH RELEVANCE & ACCURACY BENCHMARK');
  console.log('====================================================\n');

  let passed = 0;
  for (const tc of TEST_CASES) {
    console.log(`🔎 Test Query: "${tc.query}"`);
    console.log(`   Expectation: ${tc.description}`);

    const res = hybridSearchEngine.search(tc.query, { limit: 5 });
    console.log(`   Total Candidates Matched: ${res.totalResults} (took ${res.tookMs}ms)`);

    if (res.results.length === 0) {
      console.log(`   ❌ FAILED: No results returned\n`);
      continue;
    }

    const topResult = res.results[0];
    const topAd = topResult.ad;
    console.log(`   🏆 Top Result #1 (Score: ${topResult.score}):`);
    console.log(`      Platform: ${topAd.platform} | Brand: ${topAd.brand}`);
    console.log(`      Title: ${topAd.title.slice(0, 80)}`);
    console.log(`      Matched Fields: ${topResult.explanation.matchedFields.join(', ')}`);
    console.log(`      Explanation: ${topResult.explanation.explanationNote}`);

    const matchText = `${topAd.brand} ${topAd.title} ${topAd.summary} ${topAd.platform} ${topAd.category} ${topAd.topics.join(' ')} ${topResult.explanation.matchedFields.join(' ')}`.toLowerCase();
    const satisfiesAny = tc.expectedKeywordsOrBrand.some(kw => matchText.includes(kw.toLowerCase()));

    if (satisfiesAny) {
      console.log(`   ✅ PASSED\n`);
      passed++;
    } else {
      console.log(`   ⚠️ WARNING: Top result does not contain expected terms (${tc.expectedKeywordsOrBrand.join(', ')})\n`);
    }
  }

  console.log(`====================================================`);
  console.log(`Benchmark Summary: ${passed}/${TEST_CASES.length} tests passed`);
  console.log(`====================================================`);
  return passed === TEST_CASES.length;
}

if (require.main === module) {
  runRelevanceBenchmark();
}
