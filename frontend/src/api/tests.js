import request from './request'

export function getCaseList(params) {
  return request({
    url: '/tests/cases',
    method: 'get',
    params
  })
}

export function getCaseDetail(id) {
  return request({
    url: `/tests/cases/${id}`,
    method: 'get'
  })
}

export function createCase(data) {
  return request({
    url: '/tests/cases',
    method: 'post',
    data
  })
}

export function updateCase(id, data) {
  return request({
    url: `/tests/cases/${id}`,
    method: 'put',
    data
  })
}

export function deleteCase(id) {
  return request({
    url: `/tests/cases/${id}`,
    method: 'delete'
  })
}

export function getTestSetList(params) {
  return request({
    url: '/tests/sets',
    method: 'get',
    params
  })
}

export function getTestSetDetail(id) {
  return request({
    url: `/tests/sets/${id}`,
    method: 'get'
  })
}

export function createTestSet(data) {
  return request({
    url: '/tests/sets',
    method: 'post',
    data
  })
}

export function updateTestSet(id, data) {
  return request({
    url: `/tests/sets/${id}`,
    method: 'put',
    data
  })
}

export function deleteTestSet(id) {
  return request({
    url: `/tests/sets/${id}`,
    method: 'delete'
  })
}

export function addCasesToSet(setId, caseIds) {
  return request({
    url: `/tests/sets/${setId}/cases`,
    method: 'post',
    data: { case_ids: caseIds }
  })
}

export function removeCaseFromSet(setId, caseId) {
  return request({
    url: `/tests/sets/${setId}/cases/${caseId}`,
    method: 'delete'
  })
}

export function startTestRun(data) {
  return request({
    url: '/tests/runs',
    method: 'post',
    data
  })
}

export function getTestRunList(params) {
  return request({
    url: '/tests/runs',
    method: 'get',
    params
  })
}

export function getTestRunDetail(id) {
  return request({
    url: `/tests/runs/${id}`,
    method: 'get'
  })
}

export function compareTestRuns(runIds) {
  return request({
    url: `/tests/runs/compare`,
    method: 'get',
    params: { run_ids: runIds.join(',') }
  })
}
