function orderPair(idA: string, idB: string): { userOneId: string; userTwoId: string } {
  return idA < idB ? { userOneId: idA, userTwoId: idB } : { userOneId: idB, userTwoId: idA };
}

export default orderPair;
