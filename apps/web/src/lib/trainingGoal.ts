import type { TFunction } from 'i18next';

const TRAINING_GOAL_TRANSLATION_KEYS: Record<string, string> = {
  // VI preset strings (stored when UI language was VI)
  'Xây dựng nền tảng thể lực, cự ly 1400m sân cát (Khối lượng vừa)': 'trainingPlanModal.savedGoals.baseFitness',
  'Tăng cường sức bền cự ly 1600m mặt cỏ tự nhiên (Khối lượng cao)': 'trainingPlanModal.savedGoals.endurance',
  'Rèn luyện bứt tốc nước rút cự ly 1200m chuẩn bị giải đấu': 'trainingPlanModal.savedGoals.sprint',
  'Bài tập nhẹ phục hồi thể trạng & theo dõi gân cơ': 'trainingPlanModal.savedGoals.recovery',
  'Phục hồi sau chấn thương, tăng dần cường độ': 'trainingPlanModal.savedGoals.injuryRecovery',
  'Giáo án nền tảng sức bền mùa trước': 'trainingPlanModal.savedGoals.lastSeason',
  // EN preset strings (stored when UI language was EN)
  'Build a fitness base for 1400m on dirt (moderate workload)': 'trainingPlanModal.savedGoals.baseFitness',
  'Increase endurance for 1600m on turf (high workload)': 'trainingPlanModal.savedGoals.endurance',
  'Develop a 1200m sprint finish ahead of the race': 'trainingPlanModal.savedGoals.sprint',
  'Light recovery work with tendon and muscle monitoring': 'trainingPlanModal.savedGoals.recovery',
  'Gradually increase intensity during injury recovery': 'trainingPlanModal.savedGoals.injuryRecovery',
  "Last season's endurance foundation plan": 'trainingPlanModal.savedGoals.lastSeason',
  // Seed data entry (created directly in English before presets existed)
  'Build stamina for Spring Derby 2026': 'trainingPlanModal.savedGoals.buildStaminaSprint',
};

export function translateTrainingGoal(goal: string, t: TFunction): string {
  const translationKey = TRAINING_GOAL_TRANSLATION_KEYS[goal];
  return translationKey ? t(translationKey) : goal;
}
