const logger = require('../utils/logger');

function sipMonthly(p, r, n) {
  const rate = r / 12 / 100;
  return p * ((Math.pow(1 + rate, n) - 1) / rate) * (1 + rate);
}

function lumpsum(p, r, n) {
  return p * Math.pow(1 + r / 100, n);
}

function emi(p, r, n) {
  const rate = r / 12 / 100;
  return p * rate * Math.pow(1 + rate, n) / (Math.pow(1 + rate, n) - 1);
}

function calculateSIP(monthlyInvestment, annualReturn, years) {
  const months = years * 12;
  const futureValue = sipMonthly(monthlyInvestment, annualReturn, months);
  const totalInvested = monthlyInvestment * months;
  const estimatedReturns = futureValue - totalInvested;
  return {
    monthlyInvestment, annualReturn, years, months,
    totalInvested: Math.round(totalInvested),
    estimatedReturns: Math.round(estimatedReturns),
    futureValue: Math.round(futureValue),
  };
}

function calculateLumpsum(principal, annualReturn, years) {
  const futureValue = lumpsum(principal, annualReturn, years);
  const estimatedReturns = futureValue - principal;
  return {
    principal, annualReturn, years,
    estimatedReturns: Math.round(estimatedReturns),
    futureValue: Math.round(futureValue),
  };
}

function calculateEMI(loanAmount, annualRate, years) {
  const months = years * 12;
  const monthlyEMI = emi(loanAmount, annualRate, months);
  const totalPayment = monthlyEMI * months;
  const totalInterest = totalPayment - loanAmount;
  return {
    loanAmount, annualRate, years, months,
    monthlyEMI: Math.round(monthlyEMI),
    totalInterest: Math.round(totalInterest),
    totalPayment: Math.round(totalPayment),
  };
}

function calculateRetirement(currentAge, retirementAge, lifeExpectancy, monthlyExpenses, inflationRate, annualReturn, currentSavings, monthlyInvestment) {
  const yearsToRetire = retirementAge - currentAge;
  const yearsInRetirement = lifeExpectancy - retirementAge;
  const inflatedMonthlyExpense = monthlyExpenses * Math.pow(1 + inflationRate / 100, yearsToRetire);
  const annualExpenseAtRetirement = inflatedMonthlyExpense * 12;
  const corpusNeeded = annualExpenseAtRetirement * ((1 - Math.pow(1 + annualReturn / 100, -yearsInRetirement)) / (annualReturn / 100));
  const futureSavings = lumpsum(currentSavings, annualReturn, yearsToRetire);
  const sipFutureValue = monthlyInvestment > 0 ? sipMonthly(monthlyInvestment, annualReturn, yearsToRetire * 12) : 0;
  const projectedCorpus = Math.round(futureSavings + sipFutureValue);
  const shortfall = Math.max(0, corpusNeeded - projectedCorpus);
  const additionalMonthly = shortfall > 0 ? Math.ceil(shortfall / ((Math.pow(1 + annualReturn / 12 / 100, yearsToRetire * 12) - 1) / (annualReturn / 12 / 100) * (1 + annualReturn / 12 / 100))) : 0;

  return {
    currentAge, retirementAge, lifeExpectancy, yearsToRetire, yearsInRetirement,
    monthlyExpensesAtRetirement: Math.round(inflatedMonthlyExpense),
    corpusNeeded: Math.round(corpusNeeded),
    currentSavingsProjection: Math.round(futureSavings),
    sipProjection: Math.round(sipFutureValue),
    projectedCorpus,
    shortfall: Math.round(shortfall),
    additionalMonthlyInvestment: Math.round(additionalMonthly),
    onTrack: shortfall <= 0,
  };
}

function calculateGoalProjection(currentAmount, monthlyAddition, annualReturn, years) {
  const months = years * 12;
  const rate = annualReturn / 12 / 100;
  const fvCurrent = currentAmount * Math.pow(1 + rate, months);
  const fvSIP = monthlyAddition > 0 ? monthlyAddition * ((Math.pow(1 + rate, months) - 1) / rate) * (1 + rate) : 0;
  return {
    currentAmount, monthlyAddition, annualReturn, years,
    futureValue: Math.round(fvCurrent + fvSIP),
    totalInvested: Math.round(currentAmount + monthlyAddition * months),
    estimatedReturns: Math.round((fvCurrent + fvSIP) - (currentAmount + monthlyAddition * months)),
  };
}

module.exports = { calculateSIP, calculateLumpsum, calculateEMI, calculateRetirement, calculateGoalProjection };
