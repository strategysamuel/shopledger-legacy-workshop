var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function orderItems() {
  return [
    {
      id: 1,
      name: 'Indrayani Basmati Rice 5kg',
      hsn: '1006',
      price: 640,
      qty: 1
    },
    {
      id: 12,
      name: 'Kokum Sherbet Concentrate 750ml',
      hsn: '2106',
      price: 180,
      qty: 2
    }
  ];
}

test('CURRENT BEHAVIOUR checkout bills HSN GST after the SAVE10 discount', function () {
  var totals = pricing.computeTotals(orderItems(), 'SAVE10');

  assert.deepEqual(totals, {
    subtotal: 1000,
    discount: 100,
    taxable: 900,
    tax: 87.12,
    cgst: 43.56,
    sgst: 43.56,
    total: 987.12,
    lines: [
      {
        id: 1,
        name: 'Indrayani Basmati Rice 5kg',
        hsn: '1006',
        gstPercent: 5,
        gross: 640,
        discount: 64,
        taxable: 576,
        tax: 28.8,
        net: 604.8
      },
      {
        id: 12,
        name: 'Kokum Sherbet Concentrate 750ml',
        hsn: '2106',
        gstPercent: 18,
        gross: 360,
        discount: 36,
        taxable: 324,
        tax: 58.32,
        net: 382.32
      }
    ]
  });
});

test('invoice uses the billed HSN GST and coupon totals', function () {
  var billed = pricing.computeTotals(orderItems(), 'SAVE10');
  var figures = invoice.computeInvoiceFigures({
    id: 2001,
    items: orderItems(),
    coupon: 'SAVE10',
    total: billed.total
  });

  assert.deepEqual(figures, {
    subtotal: 1000,
    discount: 100,
    tax: 87.12,
    cgst: 43.56,
    sgst: 43.56,
    total: 987.12,
    rows: [
      {
        name: 'Indrayani Basmati Rice 5kg',
        sku: '-',
        hsn: '1006',
        qty: 1,
        price: 640,
        gstPercent: 5,
        line: 640,
        lineTax: 28.8
      },
      {
        name: 'Kokum Sherbet Concentrate 750ml',
        sku: '-',
        hsn: '2106',
        qty: 2,
        price: 180,
        gstPercent: 18,
        line: 360,
        lineTax: 58.32
      }
    ]
  });
});

test('reconciliation matches an invoice to the billed order', function () {
  var billed = pricing.computeTotals(orderItems(), 'SAVE10');
  var reconciliation = reports.getGstReconciliation({
    products: [],
    customers: [],
    orders: [{
      id: 2001,
      date: '01/01/2022',
      customer: 'Walk-in',
      items: orderItems(),
      coupon: 'SAVE10',
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total
    }]
  });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.deepEqual(reconciliation.rows[0], {
    orderId: 2001,
    date: '01/01/2022',
    customer: 'Walk-in',
    coupon: 'SAVE10',
    ledgerSubtotal: 1000,
    ledgerDiscount: 100,
    ledgerTax: 87.12,
    ledgerTotal: 987.12,
    invoiceDiscount: 100,
    invoiceTax: 87.12,
    invoiceTotal: 987.12,
    delta: 0,
    matched: true
  });
});
