const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { calculateSIP, calculateLumpsum, calculateEMI, calculateRetirement, calculateGoalProjection } = require('../services/sipCalculator');

const router = express.Router();

router.post('/sip', optionalAuth, (req, res) => {
  const { monthlyInvestment, annualReturn, years } = req.body;
  if (!monthlyInvestment || !annualReturn || !years) return res.status(400).json({ error: 'monthlyInvestment, annualReturn, years required' });
  res.json({ success: true, result: calculateSIP(monthlyInvestment, annualReturn, years) });
});

router.post('/lumpsum', optionalAuth, (req, res) => {
  const { principal, annualReturn, years } = req.body;
  if (!principal || !annualReturn || !years) return res.status(400).json({ error: 'principal, annualReturn, years required' });
  res.json({ success: true, result: calculateLumpsum(principal, annualReturn, years) });
});

router.post('/emi', optionalAuth, (req, res) => {
  const { loanAmount, annualRate, years } = req.body;
  if (!loanAmount || !annualRate || !years) return res.status(400).json({ error: 'loanAmount, annualRate, years required' });
  res.json({ success: true, result: calculateEMI(loanAmount, annualRate, years) });
});

router.post('/retirement', optionalAuth, (req, res) => {
  const { currentAge, retirementAge, lifeExpectancy, monthlyExpenses, inflationRate = 6, annualReturn = 12, currentSavings = 0, monthlyInvestment = 0 } = req.body;
  if (!currentAge || !retirementAge || !lifeExpectancy || !monthlyExpenses) return res.status(400).json({ error: 'currentAge, retirementAge, lifeExpectancy, monthlyExpenses required' });
  res.json({ success: true, result: calculateRetirement(currentAge, retirementAge, lifeExpectancy, monthlyExpenses, inflationRate, annualReturn, currentSavings, monthlyInvestment) });
});

router.post('/goal', optionalAuth, (req, res) => {
  const { currentAmount = 0, monthlyAddition = 0, annualReturn = 12, years } = req.body;
  if (!years) return res.status(400).json({ error: 'years required' });
  res.json({ success: true, result: calculateGoalProjection(currentAmount, monthlyAddition, annualReturn, years) });
});

module.exports = router;
