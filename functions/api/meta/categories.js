import { json } from '../../_lib/http.js';

const DISH_CATEGORIES = ['主食', '主菜', '副菜', '時蔬', '配菜', '湯品', '甜點', '飲料'];

export async function onRequestGet() {
  return json({
    dishCategories: DISH_CATEGORIES,
    proteinTypes: ['雞', '豬', '牛', '羊', '魚', '海鮮', '蛋', '豆', '素', '其他'],
    cookingMethods: ['炒', '炸', '滷', '蒸', '煮', '涼拌', '烤', '生食', '其他'],
    colorTags: ['紅', '橙', '黃', '綠', '藍', '紫', '白', '黑', '褐', '其他'],
  });
}
