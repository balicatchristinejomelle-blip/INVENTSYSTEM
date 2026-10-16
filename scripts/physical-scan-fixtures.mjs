// Legacy relationship/storage suites now supply an explicit simulated physical scan.
// check-process-flow tests missing/wrong/stale scan evidence WITHOUT this adapter.
export function physicalScanArgs(name, state, original) {
  const args=[...original],pipe=state.finishedGoods.find(item=>item.id===args[0]);
  const meta={shift:'Day',scannerMode:'Regression physical scan',barcode:pipe?.barcode,orderId:pipe?.reservedForOrderId||pipe?.customerOrderId};
  if(name==='updateFinishedGoodStorage'){while(args.length<5)args.push(undefined);args[4]=meta;}
  if(name==='releaseFinishedGood')args[1]=meta;
  if(name==='receivePellet')args[1]={...meta,barcode:state.pellets.find(item=>item.id===args[0])?.barcode};
  return args;
}
