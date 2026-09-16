const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xjfbbanwjvjruoyofkek.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZmJiYW53anZqcnVveW9ma2VrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTkxNzY0NCwiImV4cCI6MjEwMTQ5MzY0NH0.AAjnNoOIjTzSZugyFK0JgsxfLzLfzTEDLqjBl4QMHcg';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function addEstimation() {
  try {
    const userId = '583d269c-f183-45aa-8e25-dbb442b836ff';
    const requirementId = '82019514-e48e-47ae-b19b-ad163961bed1'; // The E-Commerce Platform requirement

    // Create an estimation
    const { data: estimation, error } = await supabase
      .from('estimations')
      .insert({
        user_id: userId,
        requirement_id: requirementId,
        base_effort: 360,
        total_effort: 540,
        timeline: 1,
        team_size: 20,
        cost_per_hour: 300,
        total_budget: 162000,
        confidence: 85,
        answers: {
          1: 'Mid-level (2-5 years)',
          2: 20,
          3: 40,
          4: 'Moderately Familiar',
          5: 'Comprehensive Testing',
          6: 'Moderate (Realistic)',
          7: 'Tight (2-3 weeks)',
          8: 300
        },
        breakdown: {
          skillFactor: 1.0,
          techFactor: 1.0,
          testFactor: 1.5,
          riskFactor: 1.0,
          deadlineFactor: 1.0
        },
        assumptions: [
          'Project complexity score of 45 used as baseline',
          'Team size: 20 developers (full-time)',
          'Team skill level: Mid-level (2-5 years)',
          'Technology familiarity: Moderately Familiar',
          'Testing level: Comprehensive Testing',
          'Risk approach: Moderate (Realistic)',
          'No major scope changes after project initiation',
          'Requirements are stable and clearly defined',
          'Development environment and tools are readily available',
          'Team has continuous access to stakeholders for clarifications'
        ]
      })
      .select()
      .single();

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('✓ Estimation created with team size 20:');
    console.log('  Total Effort:', estimation.total_effort, 'hours');
    console.log('  Timeline:', estimation.timeline, 'weeks');
    console.log('  Team Size:', estimation.team_size, 'developers');
    console.log('  Budget:', '$' + estimation.total_budget);
    console.log('\nRefresh the browser to see the updated estimation!');
  } catch (err) {
    console.error('Error:', err);
  }
}

addEstimation();
