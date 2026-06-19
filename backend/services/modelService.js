const axios = require('axios');
const db = require('../db/database');

async function chatCompletion(options) {
  const { api_base, api_key, model, endpoint = '/v1/chat/completions', system_prompt, user_prompt } = options;

  const url = api_base.endsWith('/') 
    ? api_base + endpoint.replace(/^\//, '') 
    : api_base + endpoint;

  const headers = {
    'Content-Type': 'application/json'
  };

  if (api_key) {
    headers['Authorization'] = `Bearer ${api_key}`;
  }

  const messages = [];
  if (system_prompt) {
    messages.push({ role: 'system', content: system_prompt });
  }
  messages.push({ role: 'user', content: user_prompt });

  const requestBody = {
    model,
    messages,
    temperature: options.temperature || 0.7,
    max_tokens: options.max_tokens || 2048
  };

  try {
    const response = await axios.post(url, requestBody, {
      headers,
      timeout: options.timeout || 60000
    });

    const data = response.data;
    
    if (data.choices && data.choices.length > 0) {
      const choice = data.choices[0];
      return {
        content: choice.message?.content || '',
        role: choice.message?.role || 'assistant',
        usage: data.usage || null,
        model: data.model || model
      };
    }

    throw new Error('No choices returned from model');
  } catch (error) {
    if (error.response) {
      throw new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      throw new Error(`Network Error: Could not connect to ${api_base}`);
    }
    throw error;
  }
}

function extractEmotionStyle(text) {
  const result = {
    emotion: '',
    style: ''
  };

  const emotionPatterns = [
    /情[绪感]?\s*[:：]\s*([^\n,，、]+)/i,
    /情感\s*[:：]\s*([^\n,，、]+)/i,
    /emotion\s*[:：]\s*([^\n,，、]+)/i,
    /语气\s*[:：]\s*([^\n,，、]+)/i,
  ];

  const stylePatterns = [
    /风格\s*[:：]\s*([^\n,，、]+)/i,
    /style\s*[:：]\s*([^\n,，、]+)/i,
    /配音风格\s*[:：]\s*([^\n,，、]+)/i,
    /说话风格\s*[:：]\s*([^\n,，、]+)/i,
  ];

  for (const pattern of emotionPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.emotion = match[1].trim();
      break;
    }
  }

  for (const pattern of stylePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.style = match[1].trim();
      break;
    }
  }

  if (!result.emotion) {
    const commonEmotions = ['开心', '悲伤', '愤怒', '平静', '紧张', '温柔', '严肃', '活泼', '低沉', '高昂', '恐惧', '厌恶', '惊讶'];
    for (const emotion of commonEmotions) {
      if (text.includes(emotion)) {
        result.emotion = emotion;
        break;
      }
    }
  }

  if (!result.style) {
    const commonStyles = ['正式', '随意', '播音腔', '生活化', '戏剧化', '旁白', '对话', '叙述', '广告腔', '新闻腔'];
    for (const style of commonStyles) {
      if (text.includes(style)) {
        result.style = style;
        break;
      }
    }
  }

  return result;
}

function calculateEvaluationScore(options) {
  const { expected_emotion, expected_style, detected_emotion, detected_style } = options;
  
  let score = 0;
  let totalWeight = 0;

  if (expected_emotion) {
    totalWeight += 0.6;
    if (detected_emotion === expected_emotion) {
      score += 0.6;
    } else if (detected_emotion && expected_emotion) {
      const similarity = stringSimilarity(detected_emotion, expected_emotion);
      score += 0.6 * similarity;
    }
  }

  if (expected_style) {
    totalWeight += 0.4;
    if (detected_style === expected_style) {
      score += 0.4;
    } else if (detected_style && expected_style) {
      const similarity = stringSimilarity(detected_style, expected_style);
      score += 0.4 * similarity;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.min(score / totalWeight, 1);
}

function stringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const set1 = new Set(str1);
  const set2 = new Set(str2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

module.exports = {
  chatCompletion,
  extractEmotionStyle,
  calculateEvaluationScore,
  stringSimilarity
};
