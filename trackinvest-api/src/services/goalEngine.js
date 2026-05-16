const supabase = require('./supabase');
const logger = require('../utils/logger');

async function createGoal(userId, data) {
  const client = supabase.getClient();
  if (!client) throw Object.assign(new Error('Supabase not configured'), { status: 503, expose: true });
  const { data: goal, error } = await client.from('goals').insert({
    user_id: userId, name: data.name, target_amount: data.targetAmount,
    current_amount: data.currentAmount || 0, target_date: data.targetDate,
    category: data.category || 'general',
  }).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 400, expose: true });
  return goal;
}

async function getGoals(userId) {
  const client = supabase.getClient();
  if (!client) return [];
  const { data } = await client.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  return data || [];
}

async function getGoal(id, userId) {
  const client = supabase.getClient();
  const { data } = await client.from('goals').select('*').eq('id', id).eq('user_id', userId).single();
  return data;
}

async function updateGoal(id, userId, updates) {
  const client = supabase.getClient();
  const allowed = {};
  if (updates.name) allowed.name = updates.name;
  if (updates.targetAmount) allowed.target_amount = updates.targetAmount;
  if (updates.currentAmount !== undefined) allowed.current_amount = updates.currentAmount;
  if (updates.targetDate) allowed.target_date = updates.targetDate;
  if (updates.category) allowed.category = updates.category;
  const { data } = await client.from('goals').update(allowed).eq('id', id).eq('user_id', userId).select('*').single();
  return data;
}

async function deleteGoal(id, userId) {
  const client = supabase.getClient();
  await client.from('goals').delete().eq('id', id).eq('user_id', userId);
}

function calculateProjections(currentAmount, targetAmount, targetDate) {
  const now = new Date();
  const target = new Date(targetDate);
  const monthsLeft = Math.max(1, (target - now) / (1000 * 60 * 60 * 24 * 30.44));
  const yearsLeft = monthsLeft / 12;
  const remaining = Math.max(0, targetAmount - currentAmount);
  const monthlyNeeded = monthsLeft > 0 ? remaining / monthsLeft : remaining;
  const progressPct = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

  if (monthsLeft < 1) return { monthsLeft: 0, yearsLeft: 0, remaining, monthlyNeeded, progressPct: Math.min(100, progressPct), onTrack: currentAmount >= targetAmount };

  const suggestedMonthly = monthlyNeeded;
  const annualReturn = 0.12;
  const monthlyRate = annualReturn / 12;
  const futureValue = currentAmount * Math.pow(1 + monthlyRate, monthsLeft) +
    suggestedMonthly * ((Math.pow(1 + monthlyRate, monthsLeft) - 1) / monthlyRate);
  const onTrack = futureValue >= targetAmount;

  return {
    monthsLeft: Math.round(monthsLeft),
    yearsLeft: parseFloat(yearsLeft.toFixed(1)),
    remaining: Math.round(remaining),
    monthlyNeeded: Math.round(monthlyNeeded),
    progressPct: parseFloat(progressPct.toFixed(1)),
    projectedValue: Math.round(futureValue),
    onTrack,
  };
}

async function batchUpdateProgress(userId, transactions) {
  const client = supabase.getClient();
  if (!client) return;
  const goals = await getGoals(userId);
  for (const goal of goals) {
    if (!goal.target_date) continue;
    const projections = calculateProjections(goal.current_amount, goal.target_amount, goal.target_date);
    await client.from('goals').update({
      current_amount: goal.current_amount,
    }).eq('id', goal.id);
  }
}

module.exports = { createGoal, getGoals, getGoal, updateGoal, deleteGoal, calculateProjections, batchUpdateProgress };
