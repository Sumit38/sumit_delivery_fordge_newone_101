const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xjfbbanwjvjruoyofkek.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZmJiYW53anZqcnVveW9ma2VrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTkxNzY0NCwiZXhwIjoyMTAxNDkzNjQ0fQ.AAjnNoOIjTzSZugyFK0JgsxfLzLfzTEDLqjBl4QMHcg';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createTestAnalysis() {
  try {
    const userId = '583d269c-f183-45aa-8e25-dbb442b836ff';

    // Create a requirement
    const { data: requirement, error: reqError } = await supabase
      .from('requirements')
      .insert({
        user_id: userId,
        title: 'E-Commerce Platform',
        document_text: 'Build a complete e-commerce platform with user authentication, product catalog, shopping cart, payment processing via Stripe, order management, and admin dashboard.',
      })
      .select()
      .single();

    if (reqError) {
      console.error('Requirement error:', reqError);
      return;
    }

    console.log('✓ Requirement created:', requirement.id);

    // Create complexity results
    const { data: analysis, error: analysisError } = await supabase
      .from('complexity_results')
      .insert({
        requirement_id: requirement.id,
        nodes_count: 35,
        edges_count: 45,
        complexity_score: 45,
        test_scenarios: 25,
        analysis_data: {
          nodes: ['Authentication', 'Product Catalog', 'Shopping Cart', 'Payment', 'Orders', 'Admin', 'Reviews', 'Wishlist'],
          edges: [],
          paths: ['User Registration', 'Product Search', 'Add to Cart', 'Checkout', 'Order Tracking'],
          decisionPoints: [
            'User logged in?',
            'Product in stock?',
            'Payment approved?',
            'Delivery address valid?'
          ],
          alternativePaths: 12,
          analysis: 'E-commerce platform with multiple integrations and user flows',
          reasoning: 'N=35, E=45, P=12 → M = 45 - 35 + 2(12) = 34',
          confidenceScore: 85,
          confidenceReason: 'Analysis based on comprehensive requirements'
        }
      })
      .select()
      .single();

    if (analysisError) {
      console.error('Analysis error:', analysisError);
      return;
    }

    console.log('✓ Complexity results created:', analysis.id);
    console.log('\nTest Analysis Created:');
    console.log('  Requirement ID:', requirement.id);
    console.log('  Complexity Score:', analysis.complexity_score);
    console.log('  Node Count:', analysis.nodes_count);
    console.log('  Edge Count:', analysis.edges_count);
    console.log('\nRefresh your dashboard to see the analysis!');
  } catch (err) {
    console.error('Error:', err);
  }
}

createTestAnalysis();
