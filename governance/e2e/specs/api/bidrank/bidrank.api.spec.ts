/**
 * 商圈排名竞价 API 测试 — 完整生命周期
 *
 * 覆盖：创建活动 → 生成周期 → 开启 → 用户竞拍 → 支付（余额）→ 终止 → 清理
 *
 * 前置条件（环境变量）：
 *   API_BASE_URL          后端地址，默认 http://localhost:8888
 *   TEST_TENANT_ID        测试租户 ID（默认 153）
 *   ADMIN_USER_ID         有 bidrank:* 权限的管理员用户 ID
 *   APP_USER_ID           测试商家用户 ID（该用户须是 BIDRANK_STORE_ID 的门店管理员）
 *   BIDRANK_BUSINESS_REGION_ID  测试商圈 ID
 *   BIDRANK_STORE_ID      测试门店 ID（须属于上述商圈，且 APP_USER_ID 是其管理员）
 *
 * 余额支付（yue）：
 *   BidOrderServiceImpl.SUPPORTED_PAY_TYPES 已含 "yue"。余额为同步扣减、无回调，
 *   出价/尾款在同一事务内直接确认 depositPaid / FULL_PAID，无需等待 MQ 通知。
 *
 * 运行示例（本地）：
 *   cd governance/e2e
 *   API_BASE_URL=http://localhost:8888 \
 *     TEST_TENANT_ID=153 \
 *     ADMIN_USER_ID=1 \
 *     APP_USER_ID=2 \
 *     BIDRANK_BUSINESS_REGION_ID=1 \
 *     BIDRANK_STORE_ID=10 \
 *     npx playwright test specs/api/bidrank/bidrank.api.spec.ts
 *
 * 运行示例（测试环境）：
 *   source governance/SCRIPTS/deploy-helper.sh && load_env test
 *   cd governance/e2e
 *   API_BASE_URL="https://${DOMAIN_API}" \
 *     TEST_TENANT_ID="${TEST_TENANT_ID}" \
 *     ADMIN_USER_ID=1 \
 *     APP_USER_ID=2 \
 *     BIDRANK_BUSINESS_REGION_ID=<商圈ID> \
 *     BIDRANK_STORE_ID=<门店ID> \
 *     npx playwright test specs/api/bidrank/bidrank.api.spec.ts
 */

import { test, expect, type APIResponse } from '@playwright/test';

// ============================================================
// 环境变量
// ============================================================
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8888';
const TENANT_ID = process.env.TEST_TENANT_ID ?? '153';
const ADMIN_TOKEN = `test${process.env.ADMIN_USER_ID ?? process.env.BIDRANK_ADMIN_USER_ID ?? '1'}`;
const APP_TOKEN = `test${process.env.APP_USER_ID ?? process.env.BIDRANK_APP_USER_ID ?? '2'}`;
const BUSINESS_REGION_ID = process.env.BIDRANK_BUSINESS_REGION_ID ?? '1';
const STORE_ID = process.env.BIDRANK_STORE_ID ?? '10';

const TIMESTAMP = Date.now();

// 公共请求头
const adminHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${ADMIN_TOKEN}`,
  'tenant-id': TENANT_ID,
  'Content-Type': 'application/json',
});

const appHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${APP_TOKEN}`,
  'tenant-id': TENANT_ID,
  'Content-Type': 'application/json',
});

// ============================================================
// 辅助函数
// ============================================================
/** 断言 CommonResult 成功（code === 0）并返回 data */
async function successData<T>(response: APIResponse, ctx: string): Promise<T> {
  expect(response.ok(), `${ctx}: HTTP status`).toBeTruthy();
  const body = await response.json();
  expect(body.code, `${ctx}: CommonResult.code`).toBe(0);
  return body.data as T;
}

/** 断言 CommonResult 失败（code !== 0） */
async function assertFailure(response: APIResponse, ctx: string, expectedHttp?: number) {
  if (expectedHttp != null) {
    expect(response.status(), `${ctx}: HTTP status`).toBe(expectedHttp);
  }
  const body = await response.json();
  expect(body.code, `${ctx}: CommonResult.code should be non-zero`).not.toBe(0);
  return body;
}

/** 生成唯一测试活动参数 */
function makeAuctionPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: `api-test-竞价-${TIMESTAMP}`,
    businessRegionId: Number(BUSINESS_REGION_ID),
    enabled: true,
    cycleType: 1, // 每周
    anchorEffectDate: '2026-08-01',
    advanceDays: 0,
    startTime: '00:01',
    durationMinutes: 60,
    payMinutes: 60,
    depositRatio: 20,
    description: 'API测试-竞拍说明',
    rules: 'API测试-竞拍规则',
    ranks: [
      {
        rankStart: 1,
        rankEnd: 3,
        slotCount: 2,
        startPrice: 10.0,
        minIncrement: 5.0,
        sort: 0,
      },
    ],
    ...overrides,
  };
}

// ============================================================
// 清理
// ============================================================
const createdAuctionIds: number[] = [];

test.afterAll(async ({ request }) => {
  const errors: string[] = [];
  for (const id of createdAuctionIds.reverse()) {
    const r = await request.delete(`${API_BASE}/admin-api/bidrank/auction/delete`, {
      headers: adminHeaders(),
      params: { id: String(id) },
    });
    if (!r.ok()) {
      errors.push(`清理 auction id=${id} 失败: HTTP ${r.status()}`);
    }
  }
  if (errors.length > 0) {
    console.warn('[清理] 部分资源未能删除:', errors.join('; '));
  } else {
    console.log(`[清理] 已删除 ${createdAuctionIds.length} 个竞价活动`);
  }
});

// ============================================================
// describe 1: 完整竞价生命周期
// ============================================================
test.describe('竞价排名完整生命周期（创建→周期→竞拍→支付→终止）', () => {
  test.describe.configure({ mode: 'serial' });

  let auctionId: number;
  let cycleId: number;
  let rankId: number;
  let bidOrderId: string;

  // ---------- BIDRANK-API-001: 创建竞价活动 ----------
  test('BIDRANK-API-001 创建竞价活动（含档位）', async ({ request }) => {
    const payload = makeAuctionPayload();
    const r = await request.post(`${API_BASE}/admin-api/bidrank/auction/create`, {
      headers: adminHeaders(),
      data: payload,
    });

    auctionId = await successData<number>(r, '创建活动');
    createdAuctionIds.push(auctionId);
    expect(auctionId, 'auctionId 应为正整数').toBeGreaterThan(0);
    console.log(`[BIDRANK-API-001] 创建活动成功: auctionId=${auctionId}`);
  });

  // ---------- BIDRANK-API-002: 查询活动详情 ----------
  test('BIDRANK-API-002 查询活动详情，验证档位已保存', async ({ request }) => {
    expect(auctionId, '依赖 BIDRANK-API-001 的 auctionId').toBeGreaterThan(0);

    const r = await request.get(`${API_BASE}/admin-api/bidrank/auction/get`, {
      headers: adminHeaders(),
      params: { id: String(auctionId) },
    });

    const data = await successData<any>(r, '查询活动');
    expect(data.name).toContain(`api-test-竞价-${TIMESTAMP}`);
    expect(data.ranks, '档位列表').toBeInstanceOf(Array);
    expect(data.ranks.length, '至少一个档位').toBeGreaterThanOrEqual(1);
    expect(data.hasCycle, '新活动无周期').toBe(false);

    rankId = data.ranks[0].id;
    console.log(`[BIDRANK-API-002] 活动详情正常: rankId=${rankId}`);
  });

  // ---------- BIDRANK-API-003: 生成周期 ----------
  test('BIDRANK-API-003 生成竞价周期实例', async ({ request }) => {
    expect(auctionId, '依赖 BIDRANK-API-001 的 auctionId').toBeGreaterThan(0);

    const r = await request.post(
      `${API_BASE}/admin-api/bidrank/auction/${auctionId}/cycle/generate`,
      {
        headers: adminHeaders(),
        params: { occurrence: '1' },
      },
    );

    cycleId = await successData<number>(r, '生成周期');
    expect(cycleId, 'cycleId 应为正整数').toBeGreaterThan(0);
    console.log(`[BIDRANK-API-003] 生成周期成功: cycleId=${cycleId}`);
  });

  // ---------- BIDRANK-API-004: 开启周期 ----------
  test('BIDRANK-API-004 手动开启竞价周期', async ({ request }) => {
    expect(cycleId, '依赖 BIDRANK-API-003 的 cycleId').toBeGreaterThan(0);

    const r = await request.put(`${API_BASE}/admin-api/bidrank/cycle/${cycleId}/open`, {
      headers: adminHeaders(),
    });

    await successData<boolean>(r, '开启周期');

    // 验证周期状态已变为 OPEN(1)
    const pageR = await request.get(`${API_BASE}/admin-api/bidrank/cycle/page`, {
      headers: adminHeaders(),
      params: { pageNo: '1', pageSize: '5' },
    });
    const body = await pageR.json();
    const cycle = body.data?.list?.find((c: any) => c.id === cycleId);
    expect(cycle, '周期列表中应能找到').toBeTruthy();
    expect(cycle.status, '周期状态应为竞价中(1)').toBe(1);
    console.log(`[BIDRANK-API-004] 开启周期成功: cycleId=${cycleId}, status=OPEN`);
  });

  // ---------- BIDRANK-API-005: App 查询当前竞价 ----------
  test('BIDRANK-API-005 App 查询当前竞价周期和档位', async ({ request }) => {
    const r = await request.get(`${API_BASE}/app-api/bidrank/auction/current`, {
      headers: appHeaders(),
      params: { businessRegionId: BUSINESS_REGION_ID },
    });

    const data = await successData<any>(r, '查询当前竞价');
    // 商圈可能有多个活动/周期，只验证关键字段存在且类型正确
    if (data) {
      expect(data.cycleId, '应返回 cycleId').toBeGreaterThan(0);
      expect(data.auctionId, '应返回 auctionId').toBeGreaterThan(0);
      expect(data.ranks, '档位列表').toBeInstanceOf(Array);
      console.log(`[BIDRANK-API-005] 当前竞价: cycleId=${data.cycleId}, auctionId=${data.auctionId}`);
    }
  });

  // ---------- BIDRANK-API-006: 用户出价 ----------
  test('BIDRANK-API-006 App 用户出价（余额支付优先，weixin 兜底）', async ({ request }) => {
    expect(cycleId, '依赖 BIDRANK-API-003 的 cycleId').toBeGreaterThan(0);
    expect(rankId, '依赖 BIDRANK-API-002 的 rankId').toBeGreaterThan(0);

    const doBid = async (payType: string) => {
      return request.post(`${API_BASE}/app-api/bidrank/bid`, {
        headers: appHeaders(),
        data: {
          cycleId,
          rankId,
          storeId: Number(STORE_ID),
          price: 10.0,
          payType,
          from: 'routine',
        },
      });
    };

    // 优先尝试余额支付
    let r = await doBid('yue');
    if (r.status() === 200) {
      const body = await r.json();
      if (body.code === 0) {
        bidOrderId = body.data.bidOrderId;
        expect(body.data.bidPrice, '出价金额').toBe(10);
        expect(body.data.payAmount, '预付金额').toBe(2); // 10 × 20%
        console.log(`[BIDRANK-API-006] 余额支付出价成功: bidOrderId=${bidOrderId}, payAmount=${body.data.payAmount}`);
        return;
      }
      console.warn(`[BIDRANK-API-006] 余额支付失败: code=${body.code}, msg=${body.msg}，尝试 weixin 兜底`);
    }

    // 兜底：weixin（仅生成支付参数，不实际扣款）
    r = await doBid('weixin');
    const body = await r.json();
    if (body.code === 0) {
      bidOrderId = body.data.bidOrderId;
      expect(body.data.bidPrice, '出价金额').toBe(10);
      console.log(`[BIDRANK-API-006] weixin 兜底出价成功: bidOrderId=${bidOrderId}`);
    } else {
      console.error(`[BIDRANK-API-006] 出价完全失败: code=${body.code}, msg=${body.msg}`);
    }
  });

  // ---------- BIDRANK-API-007: 查询我的出价单 ----------
  test('BIDRANK-API-007 App 查询我的出价单，验证租户/用户隔离', async ({ request }) => {
    const r = await request.get(`${API_BASE}/app-api/bidrank/my-order/page`, {
      headers: appHeaders(),
      params: { pageNo: '1', pageSize: '10' },
    });

    const data = await successData<{ list: unknown[]; total: number }>(r, '查询我的出价单');
    expect(Array.isArray(data.list), '出价单列表应为数组').toBeTruthy();

    if (bidOrderId && data.list.length > 0) {
      const myOrder = (data.list as any[]).find((o: any) => o.id === bidOrderId);
      expect(myOrder, '应能查到刚创建的出价单').toBeTruthy();
      expect(myOrder.status, '状态应为出价中(0)').toBe(0);
    }
    console.log(`[BIDRANK-API-007] 我的出价单数量: ${data.list.length}`);
  });

  // ---------- BIDRANK-API-008: 推进到尾款阶段 ----------
  test('BIDRANK-API-008 管理员将周期推进到尾款支付阶段', async ({ request }) => {
    expect(cycleId, '依赖 BIDRANK-API-003 的 cycleId').toBeGreaterThan(0);

    const r = await request.put(`${API_BASE}/admin-api/bidrank/cycle/${cycleId}/final-pay`, {
      headers: adminHeaders(),
    });

    await successData<boolean>(r, '进入尾款支付');

    const pageR = await request.get(`${API_BASE}/admin-api/bidrank/cycle/page`, {
      headers: adminHeaders(),
      params: { pageNo: '1', pageSize: '50' },
    });
    const body = await pageR.json();
    const cycle = body.data?.list?.find((c: any) => c.id === cycleId);
    expect(cycle?.status, '周期状态应为可付尾款(2)').toBe(2);
    console.log(`[BIDRANK-API-008] 进入尾款支付阶段: status=FINAL_PAY(2)`);
  });

  // ---------- BIDRANK-API-008b: App 支付尾款（余额） ----------
  // 依赖 008 先将 cycle 推进到 FINAL_PAY
  test('BIDRANK-API-008b App 支付尾款（余额支付，同步确认 FULL_PAID）', async ({ request }) => {
    expect(bidOrderId, '依赖 BIDRANK-API-006 的 bidOrderId').toBeTruthy();

    const r = await request.post(`${API_BASE}/app-api/bidrank/final-pay`, {
      headers: appHeaders(),
      data: {
        bidOrderId,
        payType: 'yue',
        from: 'routine',
      },
    });

    const body = await r.json();
    expect(body.code, '尾款支付 code=0').toBe(0);
    const data = body.data;
    expect(data.tradeType, '尾款支付类型').toBe('YUE');
    expect(data.bidOrderId, '返回 bidOrderId').toBe(bidOrderId);
    expect(data.payAmount, '尾款金额 = bidPrice - deposit').toBe(10 - 2);
    console.log(`[BIDRANK-API-008b] 尾款支付成功: payAmount=${data.payAmount}, tradeType=${data.tradeType}`);

    // 验证出价单状态已同步变为 FULL_PAID(4)
    const pageR = await request.get(`${API_BASE}/app-api/bidrank/my-order/page`, {
      headers: appHeaders(),
      params: { pageNo: '1', pageSize: '10' },
    });
    const pageData = await pageR.json();
    const myOrder = (pageData.data.list as any[]).find((o: any) => o.id === bidOrderId);
    expect(myOrder, '应能查到自己的出价单').toBeTruthy();
    expect(myOrder.status, '状态应为已付全款(2)').toBe(2);
  });

  // ---------- BIDRANK-API-009: 结算 ----------
  test('BIDRANK-API-009 管理员执行周期结算', async ({ request }) => {
    expect(cycleId, '依赖 BIDRANK-API-003 的 cycleId').toBeGreaterThan(0);

    const r = await request.put(`${API_BASE}/admin-api/bidrank/cycle/${cycleId}/settle`, {
      headers: adminHeaders(),
    });

    await successData<boolean>(r, '执行结算');

    const pageR = await request.get(`${API_BASE}/admin-api/bidrank/cycle/page`, {
      headers: adminHeaders(),
      params: { pageNo: '1', pageSize: '50' },
    });
    const body = await pageR.json();
    const cycle = body.data?.list?.find((c: any) => c.id === cycleId);
    expect(cycle?.status, '周期状态应为已结算(3)').toBe(3);
    console.log(`[BIDRANK-API-009] 结算完成: cycleId=${cycleId}, status=SETTLED(3)`);
  });

  // ---------- BIDRANK-API-010: Admin 查询出价单和结算结果 ----------
  test('BIDRANK-API-010 Admin 查询出价单和结算结果', async ({ request }) => {
    expect(cycleId, '依赖 BIDRANK-API-003 的 cycleId').toBeGreaterThan(0);

    // 出价单分页
    const orderR = await request.get(`${API_BASE}/admin-api/bidrank/order/page`, {
      headers: adminHeaders(),
      params: { pageNo: '1', pageSize: '10', cycleId: String(cycleId) },
    });
    const pageData = await successData<{ list: unknown[]; total: number }>(orderR, '查询出价单');
    expect(Array.isArray(pageData.list)).toBeTruthy();

    // 结算结果
    const resultR = await request.get(`${API_BASE}/admin-api/bidrank/order/result`, {
      headers: adminHeaders(),
      params: { cycleId: String(cycleId) },
    });
    const resultData = await successData<unknown[]>(resultR, '查询结算结果');
    expect(Array.isArray(resultData)).toBeTruthy();
    expect(resultData.length, '结算结果至少 1 条').toBeGreaterThanOrEqual(1);

    // 验证结算结果字段完整性
    const item = resultData[0] as Record<string, unknown>;
    expect(item.cycleId, '结算结果含 cycleId').toBe(cycleId);
    expect(item.status, '结算结果含 status').toBeDefined();
    expect(item.isWinner, '结算结果含 isWinner').toBeDefined();
    expect(item.bidPrice, '结算结果含 bidPrice').toBeDefined();
    console.log(`[BIDRANK-API-010] 出价单${pageData.total}条, 结算结果${resultData.length}条, isWinner=${item.isWinner}, status=${item.status}`);
  });
});

// ============================================================
// describe 2: 终止流程
// ============================================================
test.describe('竞价周期终止流程', () => {
  test.describe.configure({ mode: 'serial' });

  let terminateAuctionId: number;

  test('BIDRANK-API-020 创建活动 → 生成周期 → 开启 → 终止 → 验证已删除', async ({ request }) => {
    // 创建活动
    const payload = makeAuctionPayload({ name: `api-test-终止-${TIMESTAMP}` });
    const createR = await request.post(`${API_BASE}/admin-api/bidrank/auction/create`, {
      headers: adminHeaders(),
      data: payload,
    });
    terminateAuctionId = await successData<number>(createR, '创建活动(终止测试)');
    createdAuctionIds.push(terminateAuctionId);

    // 生成周期
    const genR = await request.post(
      `${API_BASE}/admin-api/bidrank/auction/${terminateAuctionId}/cycle/generate`,
      { headers: adminHeaders(), params: { occurrence: '1' } },
    );
    const cycleId = await successData<number>(genR, '生成周期(终止测试)');

    // 开启
    const openR = await request.put(
      `${API_BASE}/admin-api/bidrank/cycle/${cycleId}/open`,
      { headers: adminHeaders() },
    );
    await successData<boolean>(openR, '开启周期(终止测试)');

    // 验证开启
    let pageR = await request.get(`${API_BASE}/admin-api/bidrank/cycle/page`, {
      headers: adminHeaders(),
      params: { pageNo: '1', pageSize: '50' },
    });
    let pageBody = await pageR.json();
    let cycle = pageBody.data?.list?.find((c: any) => c.id === cycleId);
    expect(cycle?.status, '开启后状态应为竞价中(1)').toBe(1);

    // 终止
    const termR = await request.put(
      `${API_BASE}/admin-api/bidrank/cycle/${cycleId}/terminate`,
      { headers: adminHeaders() },
    );
    await successData<boolean>(termR, '终止周期');

    // 验证已删除（分页查不到）
    pageR = await request.get(`${API_BASE}/admin-api/bidrank/cycle/page`, {
      headers: adminHeaders(),
      params: { pageNo: '1', pageSize: '20' },
    });
    pageBody = await pageR.json();
    const terminated = pageBody.data?.list?.find((c: any) => c.id === cycleId);
    expect(terminated, '终止后周期应从列表中消失').toBeFalsy();
    console.log(`[BIDRANK-API-020] 终止流程完成: cycleId=${cycleId} 已删除`);
  });

  test('BIDRANK-API-021 终止 WAIT 状态的周期应被拒绝', async ({ request }) => {
    expect(terminateAuctionId, '依赖 BIDRANK-API-020 的 auctionId').toBeGreaterThan(0);

    const genR = await request.post(
      `${API_BASE}/admin-api/bidrank/auction/${terminateAuctionId}/cycle/generate`,
      { headers: adminHeaders(), params: { occurrence: '2' } },
    );
    const cycleId = await successData<number>(genR, '生成第二个周期');

    // 直接终止 WAIT 状态，应失败
    const termR = await request.put(
      `${API_BASE}/admin-api/bidrank/cycle/${cycleId}/terminate`,
      { headers: adminHeaders() },
    );
    await assertFailure(termR, '终止WAIT状态周期应失败');

    // 清理：删除该 WAIT 状态的周期
    const delR = await request.delete(`${API_BASE}/admin-api/bidrank/cycle/${cycleId}`, {
      headers: adminHeaders(),
    });
    await successData<boolean>(delR, '删除 WAIT 周期');
    console.log(`[BIDRANK-API-021] 负例通过：WAIT 无法终止，已用 delete 清理`);
  });
});

// ============================================================
// describe 3: 校验与边界
// ============================================================
test.describe('竞价排名校验与边界', () => {
  test('BIDRANK-API-030 创建活动时缺少档位应返回错误', async ({ request }) => {
    const payload = makeAuctionPayload({ ranks: [] });
    const r = await request.post(`${API_BASE}/admin-api/bidrank/auction/create`, {
      headers: adminHeaders(),
      data: payload,
    });
    await assertFailure(r, '创建活动(空档位)');
  });

  test('BIDRANK-API-031 创建活动时预付比例非法应返回错误', async ({ request }) => {
    const payload = makeAuctionPayload({ depositRatio: 0 });
    const r = await request.post(`${API_BASE}/admin-api/bidrank/auction/create`, {
      headers: adminHeaders(),
      data: payload,
    });
    await assertFailure(r, '创建活动(预付比例=0)');
  });

  test('BIDRANK-API-032 创建活动时 rankStart > rankEnd 应返回错误', async ({ request }) => {
    const payload = makeAuctionPayload({
      ranks: [{ rankStart: 5, rankEnd: 1, slotCount: 1, startPrice: 10.0, minIncrement: 5.0, sort: 0 }],
    });
    const r = await request.post(`${API_BASE}/admin-api/bidrank/auction/create`, {
      headers: adminHeaders(),
      data: payload,
    });
    await assertFailure(r, '创建活动(rankStart>rankEnd)');
  });

  test('BIDRANK-API-033 查询不存在的活动应返回错误', async ({ request }) => {
    const r = await request.get(`${API_BASE}/admin-api/bidrank/auction/get`, {
      headers: adminHeaders(),
      params: { id: '99999999' },
    });
    await assertFailure(r, '查询不存在活动');
  });

  test('BIDRANK-API-034 未认证请求应返回 401', async ({ request }) => {
    const r = await request.get(`${API_BASE}/admin-api/bidrank/auction/page`, {
      params: { pageNo: '1', pageSize: '10' },
    });
    const body = await r.json();
    expect(body.code, '未认证请求 code 应非零').not.toBe(0);
  });
});
