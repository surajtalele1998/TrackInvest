const express = require('express');
const { authMiddleware } = require('../services/authService');
const { createGoal, getGoals, getGoal, updateGoal, deleteGoal, calculateProjections } = require('../services/goalEngine');

const router = express.Router();

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const goal = await createGoal(req.user.id, req.body);
    res.status(201).json({ success: true, goal });
  } catch (err) { next(err); }
});

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const goals = await getGoals(req.user.id);
    const enriched = goals.map(g => {
      if (g.target_date) {
        const proj = calculateProjections(g.current_amount, g.target_amount, g.target_date);
        return { ...g, projections: proj };
      }
      return g;
    });
    res.json({ success: true, count: enriched.length, goals: enriched });
  } catch (err) { next(err); }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const goal = await getGoal(req.params.id, req.user.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    if (goal.target_date) goal.projections = calculateProjections(goal.current_amount, goal.target_amount, goal.target_date);
    res.json({ success: true, goal });
  } catch (err) { next(err); }
});

router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const goal = await updateGoal(req.params.id, req.user.id, req.body);
    res.json({ success: true, goal });
  } catch (err) { next(err); }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    await deleteGoal(req.params.id, req.user.id);
    res.json({ success: true, message: 'Goal deleted' });
  } catch (err) { next(err); }
});

router.post('/project', (req, res) => {
  const { currentAmount, targetAmount, targetDate } = req.body;
  if (!targetAmount || !targetDate) return res.status(400).json({ error: 'targetAmount and targetDate required' });
  const projections = calculateProjections(currentAmount || 0, targetAmount, targetDate);
  res.json({ success: true, projections });
});

module.exports = router;
