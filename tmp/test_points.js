// Mock API object for testing
const API = {
  calcBowlingPoints(s) {
    if (!s) return 0;
    let pts = 0;
    const wickets = Number(s.wickets || 0), overs = Number(s.overs_bowled || 0), runs = Number(s.runs_conceded || 0);
    pts += wickets * 50;
    if      (wickets >= 9) pts += 400; else if (wickets >= 7) pts += 300;
    else if (wickets >= 5) pts += 200; else if (wickets >= 3) pts += 100;
    pts += Number(s.maidens || 0) * 50;
    if (overs >= 2) { 
      const eco = runs / overs; 
      if (eco <= 6) pts += 100; 
      if (eco >= 12) pts -= 50; 
    }
    if (overs >= 1 && wickets === 0) pts -= 25;
    return pts;
  }
};

function test() {
  const tests = [
    { 
      name: "1 over, eco 6 (should NOT get +100 bonus)", 
      stats: { wickets: 0, overs_bowled: 1, runs_conceded: 6 },
      expected: -25 // Wicketless penalty, no bonus
    },
    { 
      name: "2 overs, eco 6 (should get +100 bonus)", 
      stats: { wickets: 0, overs_bowled: 2, runs_conceded: 12 },
      expected: 100 - 25 // 75
    },
    { 
      name: "1 over, eco 13 (should NOT get -50 penalty)", 
      stats: { wickets: 0, overs_bowled: 1, runs_conceded: 13 },
      expected: -25 // Wicketless penalty, no eco penalty
    },
    { 
      name: "2 overs, eco 13 (should get -50 penalty)", 
      stats: { wickets: 0, overs_bowled: 2, runs_conceded: 26 },
      expected: -50 - 25 // -75
    },
    { 
      name: "0.5 over, 0 wickets (should NOT get -25 wicketless penalty)", 
      stats: { wickets: 0, overs_bowled: 0.5, runs_conceded: 5 },
      expected: 0
    },
    { 
      name: "3 wickets, 2 overs, eco 5 (should get +100 bonus + 3W bonus)", 
      stats: { wickets: 3, overs_bowled: 2, runs_conceded: 10 },
      expected: (3 * 50) + 100 + 100 // 150 (wickets) + 100 (3W bonus) + 100 (eco bonus) = 350
    }
  ];

  let passed = true;
  tests.forEach(t => {
    const result = API.calcBowlingPoints(t.stats);
    if (result === t.expected) {
      console.log(`✅ PASS: ${t.name}`);
    } else {
      console.log(`❌ FAIL: ${t.name} | Expected: ${t.expected}, Got: ${result}`);
      passed = false;
    }
  });

  if (passed) {
    console.log("\nAll tests passed! 🚀");
  } else {
    console.log("\nSome tests failed. ❌");
    process.exit(1);
  }
}

test();
