import request from './request'

export function getPromptList(params) {
  return request({
    url: '/prompts',
    method: 'get',
    params
  })
}

export function getPromptDetail(id) {
  return request({
    url: `/prompts/${id}`,
    method: 'get'
  })
}

export function createPrompt(data) {
  return request({
    url: '/prompts',
    method: 'post',
    data
  })
}

export function updatePrompt(id, data) {
  return request({
    url: `/prompts/${id}`,
    method: 'put',
    data
  })
}

export function deletePrompt(id) {
  return request({
    url: `/prompts/${id}`,
    method: 'delete'
  })
}

export function previewPrompt(id, variables) {
  return request({
    url: `/prompts/${id}/preview`,
    method: 'post',
    data: { variables }
  })
}
