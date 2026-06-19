import request from './request'

export function getAudioList(params) {
  return request({
    url: '/audio',
    method: 'get',
    params
  })
}

export function getAudioDetail(id) {
  return request({
    url: `/audio/${id}`,
    method: 'get'
  })
}

export function uploadAudio(formData, onProgress) {
  return request({
    url: '/audio/upload',
    method: 'post',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
  })
}

export function updateAudio(id, data) {
  return request({
    url: `/audio/${id}`,
    method: 'put',
    data
  })
}

export function deleteAudio(id) {
  return request({
    url: `/audio/${id}`,
    method: 'delete'
  })
}

export function matchAudio(data) {
  return request({
    url: '/audio/match',
    method: 'post',
    data
  })
}

export function getEmotionTags() {
  return request({
    url: '/audio/tags/emotions',
    method: 'get'
  })
}

export function getStyleTags() {
  return request({
    url: '/audio/tags/styles',
    method: 'get'
  })
}
