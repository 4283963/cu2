import request from './request'

export function getModelList() {
  return request({
    url: '/models',
    method: 'get'
  })
}

export function getModelDetail(id) {
  return request({
    url: `/models/${id}`,
    method: 'get'
  })
}

export function createModel(data) {
  return request({
    url: '/models',
    method: 'post',
    data
  })
}

export function updateModel(id, data) {
  return request({
    url: `/models/${id}`,
    method: 'put',
    data
  })
}

export function deleteModel(id) {
  return request({
    url: `/models/${id}`,
    method: 'delete'
  })
}

export function testModel(id) {
  return request({
    url: `/models/${id}/test`,
    method: 'post'
  })
}
