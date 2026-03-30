
// Verification script for Badge Awarding Logic
// Run this with a local Node environment if possible, or just review the logic.
// This script simulates the data and checks the awardBadges function logic.

const mockMatch = { id: 'm1', actual_target: 200, winner: 'MI' };
const mockLogs = [
  { fantasy_team_id: 't1', total_points: 300, breakdown: { players: [{ name: 'Player 1', bat: 105 }] } },
  { fantasy_team_id: 't2', total_points: 150, breakdown: { players: [{ name: 'Player 2', bowl: 260 }] } }
];
const mockPreds = [
  { fantasy_team_id: 't1', target_score: 200, predicted_winner: 'MI' },
  { fantasy_team_id: 't2', target_score: 195, predicted_winner: 'MI' }
];

async function verifyBadges() {
  console.log('--- Verifying Badge Awarding Logic ---');
  
  const newBadges = [];
  const existingMap = { 't1': new Set(['some-old-badge']) };

  for (const log of mockLogs) {
    const teamId = log.fantasy_team_id;
    const teamExisting = existingMap[teamId] || new Set();
    const pred = mockPreds.find(p => p.fantasy_team_id === teamId);

    const give = (bid) => {
      if (!teamExisting.has(bid)) newBadges.push({ fantasy_team_id: teamId, badge_id: bid });
    };

    // 1. Centurion
    if (log.breakdown?.players?.some(p => p.bat >= 100)) give('centurion');
    
    // 2. Five-fer
    if (log.breakdown?.players?.some(p => p.bowl >= 250)) give('five-fer');

    // 3. Perfect Pick
    if (pred && mockMatch.actual_target && Math.abs(pred.target_score - mockMatch.actual_target) === 0) give('perfect-pick');

    // 4. Prediction Pro
    if (pred && pred.predicted_winner === mockMatch.winner && mockMatch.actual_target && Math.abs(pred.target_score - mockMatch.actual_target) <= 5) give('prediction-pro');

    // 5. High Flyer
    if (log.total_points >= 250) give('high-flyer');
  }

  console.log('New Badges Awarded:', JSON.stringify(newBadges, null, 2));
  
  const expected = [
    { fantasy_team_id: 't1', badge_id: 'centurion' },
    { fantasy_team_id: 't1', badge_id: 'perfect-pick' },
    { fantasy_team_id: 't1', badge_id: 'prediction-pro' },
    { fantasy_team_id: 't1', badge_id: 'high-flyer' },
    { fantasy_team_id: 't2', badge_id: 'five-fer' },
    { fantasy_team_id: 't2', badge_id: 'prediction-pro' }
  ];

  const pass = JSON.stringify(newBadges) === JSON.stringify(expected);
  console.log('Result:', pass ? 'PASS' : 'FAIL');
}

verifyBadges();
