import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  const bodyText = await req.text();
  const body = bodyText ? JSON.parse(bodyText) : {};

  // Criar novo Request com body já lido para evitar erro de clone
  const newReq = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: (req.method !== 'GET' && req.method !== 'HEAD' && bodyText) ? bodyText : undefined
  });
  const base44 = createClientFromRequest(newReq);

  try {
    const store_id = body?.store_id;
    const period_days = body?.period_days || 365;

    if (!store_id) {
      return Response.json({ error: 'store_id is required' }, { status: 400 });
    }

    console.log(`[RFM] Starting RFM calculation for store ${store_id}, period: ${period_days} days`);

    // Data de corte
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - period_days);
    const cutoffDateStr = cutoffDate.toISOString();

    // Buscar todos os dados necessários
    const allOrders = await base44.asServiceRole.entities.Order.list();
    const allCustomers = await base44.asServiceRole.entities.Customer.list();
    const allOrderItems = await base44.asServiceRole.entities.OrderItem.list();

    // Filtrar por store_id
    const storeOrders = allOrders.filter(o => o.store_id === store_id);
    const storeCustomers = allCustomers.filter(c => c.store_id === store_id);

    console.log(`[RFM] Found ${storeOrders.length} orders and ${storeCustomers.length} customers`);

    // Deduplicar clientes por external_id (manter o mais recente)
    const uniqueCustomersMap = new Map();
    for (const customer of storeCustomers) {
      const key = customer.external_id;
      if (!uniqueCustomersMap.has(key) || 
          new Date(customer.updated_date) > new Date(uniqueCustomersMap.get(key).updated_date)) {
        uniqueCustomersMap.set(key, customer);
      }
    }
    const uniqueCustomers = Array.from(uniqueCustomersMap.values());
    console.log(`[RFM] After deduplication: ${uniqueCustomers.length} unique customers`);

    // Deduplicar pedidos por external_id (manter o mais recente)
    const uniqueOrdersMap = new Map();
    for (const order of storeOrders) {
      const key = order.external_id;
      if (!uniqueOrdersMap.has(key) || 
          new Date(order.updated_date) > new Date(uniqueOrdersMap.get(key).updated_date)) {
        uniqueOrdersMap.set(key, order);
      }
    }
    const uniqueOrders = Array.from(uniqueOrdersMap.values());
    console.log(`[RFM] After deduplication: ${uniqueOrders.length} unique orders`);

    // Filtrar apenas pedidos pagos e dentro do período
    const paidOrders = uniqueOrders.filter(o => {
      const isPaid = o.status === 'paid';
      const isInPeriod = new Date(o.order_date) >= cutoffDate;
      return isPaid && isInPeriod;
    });

    console.log(`[RFM] Processing ${paidOrders.length} paid orders in period`);

    // Calcular métricas por cliente
    const customerMetrics = new Map();

    for (const customer of uniqueCustomers) {
      // Pedidos deste cliente no período
      const customerOrders = paidOrders.filter(o => o.customer_id === customer.id);

      if (customerOrders.length === 0) continue;

      // Calcular métricas
      const orderDates = customerOrders.map(o => new Date(o.order_date));
      const lastPurchaseDate = new Date(Math.max(...orderDates));
      const recencyDays = Math.floor((new Date() - lastPurchaseDate) / (1000 * 60 * 60 * 24));
      const frequency = customerOrders.length;
      const monetary = customerOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
      const avgTicket = frequency > 0 ? monetary / frequency : 0;

      customerMetrics.set(customer.id, {
        customer_id: customer.id,
        customer_external_id: customer.external_id,
        recency_days: recencyDays,
        frequency: frequency,
        monetary: monetary,
        avg_ticket: avgTicket,
        last_purchase_date: lastPurchaseDate.toISOString()
      });
    }

    console.log(`[RFM] Calculated metrics for ${customerMetrics.size} customers`);

    if (customerMetrics.size === 0) {
      console.log(`[RFM] No customers with orders in period, skipping score calculation`);
      return Response.json({ 
        success: true, 
        message: 'No customers with orders in period',
        customers_processed: 0
      });
    }

    // Calcular scores (quintis)
    const metricsArray = Array.from(customerMetrics.values());
    
    // Ordenar por recência (menor = melhor)
    const sortedByRecency = [...metricsArray].sort((a, b) => a.recency_days - b.recency_days);
    const recencyPercentiles = calculatePercentiles(sortedByRecency.map(m => m.recency_days));
    
    // Ordenar por frequência (maior = melhor)
    const sortedByFrequency = [...metricsArray].sort((a, b) => b.frequency - a.frequency);
    const frequencyPercentiles = calculatePercentiles(sortedByFrequency.map(m => m.frequency));
    
    // Ordenar por monetário (maior = melhor)
    const sortedByMonetary = [...metricsArray].sort((a, b) => b.monetary - a.monetary);
    const monetaryPercentiles = calculatePercentiles(sortedByMonetary.map(m => m.monetary));

    // Atribuir scores
    for (const [customerId, metrics] of customerMetrics.entries()) {
      // R: menor recency = score maior (inverter)
      metrics.R_score = 6 - getScore(metrics.recency_days, recencyPercentiles, true);
      
      // F: maior frequency = score maior
      metrics.F_score = getScore(metrics.frequency, frequencyPercentiles, false);
      
      // M: maior monetary = score maior
      metrics.M_score = getScore(metrics.monetary, monetaryPercentiles, false);
      
      metrics.rfm_score = metrics.R_score + metrics.F_score + metrics.M_score;
      
      // Determinar segmento
      metrics.segment = determineSegment(metrics);
    }

    console.log(`[RFM] Assigned scores and segments`);

    // Salvar/atualizar na entidade RFMAnalysis
    let created = 0;
    let updated = 0;

    for (const metrics of metricsArray) {
      // Buscar registro existente
      const existing = await base44.asServiceRole.entities.RFMAnalysis.filter({
        store_id: store_id,
        customer_id: metrics.customer_id
      });

      const rfmData = {
        store_id: store_id,
        customer_id: metrics.customer_id,
        r_score: metrics.R_score,
        f_score: metrics.F_score,
        m_score: metrics.M_score,
        rfm_code: `${metrics.R_score}${metrics.F_score}${metrics.M_score}`,
        rfm_group: metrics.segment,
        recency_days: metrics.recency_days,
        frequency: metrics.frequency,
        monetary: metrics.monetary,
        last_purchase_date: metrics.last_purchase_date.split('T')[0],
        analysis_date: new Date().toISOString().split('T')[0]
      };

      if (existing.length > 0) {
        await base44.asServiceRole.entities.RFMAnalysis.update(existing[0].id, rfmData);
        updated++;
      } else {
        await base44.asServiceRole.entities.RFMAnalysis.create(rfmData);
        created++;
      }
    }

    console.log(`[RFM] Completed - Created: ${created}, Updated: ${updated}`);

    return Response.json({ 
      success: true, 
      message: `RFM calculation completed`,
      customers_processed: customerMetrics.size,
      created: created,
      updated: updated
    });

  } catch (error) {
    console.error('[RFM] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Função para calcular percentis (quintis)
function calculatePercentiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  if (n === 0) return [0, 0, 0, 0];
  
  return [
    sorted[Math.floor(n * 0.2)],
    sorted[Math.floor(n * 0.4)],
    sorted[Math.floor(n * 0.6)],
    sorted[Math.floor(n * 0.8)]
  ];
}

// Função para atribuir score (1-5) baseado em percentis
function getScore(value, percentiles, inverse = false) {
  let score;
  
  if (value <= percentiles[0]) score = 1;
  else if (value <= percentiles[1]) score = 2;
  else if (value <= percentiles[2]) score = 3;
  else if (value <= percentiles[3]) score = 4;
  else score = 5;
  
  return score;
}

// Função para determinar segmento
function determineSegment(metrics) {
  const { R_score, F_score, M_score, frequency, recency_days } = metrics;
  
  // Campeões: R>=4 e F>=4 e M>=4
  if (R_score >= 4 && F_score >= 4 && M_score >= 4) {
    return 'Campeões';
  }
  
  // Leais: F>=4 e R>=3
  if (F_score >= 4 && R_score >= 3) {
    return 'Leais';
  }
  
  // Novos: frequency==1 e recency<=30 dias
  if (frequency === 1 && recency_days <= 30) {
    return 'Novos';
  }
  
  // Promissores: R>=4 e F<=3
  if (R_score >= 4 && F_score <= 3) {
    return 'Promissores';
  }
  
  // Em Risco: R<=2 e F>=3
  if (R_score <= 2 && F_score >= 3) {
    return 'Em Risco';
  }
  
  // Dormindo: R<=2 e F<=2 e M<=3
  if (R_score <= 2 && F_score <= 2 && M_score <= 3) {
    return 'Dormindo';
  }
  
  // Padrão: Promissores
  return 'Promissores';
}