const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const generateInstalments = ({ totalAmount, plan = "FULL", startDate = new Date(), tokenAmount = 0 }) => {
  const total = Number(totalAmount || 0);
  const due = new Date(startDate);

  if (plan === "TOKEN_BALANCE") {
    const token = Number(tokenAmount || Math.max(5000, Math.round(total * 0.1)));
    return [
      { dueDate: due, amount: token, status: "PENDING" },
      { dueDate: addDays(due, 15), amount: Math.max(0, total - token), status: "PENDING" }
    ];
  }

  if (plan === "TWO_PART") {
    const first = Math.ceil(total / 2);
    return [
      { dueDate: due, amount: first, status: "PENDING" },
      { dueDate: addDays(due, 15), amount: total - first, status: "PENDING" }
    ];
  }

  if (plan === "SEMESTER_4X") {
    const part = Math.ceil(total / 4);
    return [0, 1, 2, 3].map((index) => ({
      dueDate: addMonths(due, index),
      amount: index === 3 ? total - part * 3 : part,
      status: "PENDING"
    }));
  }

  return [{ dueDate: due, amount: total, status: "PENDING" }];
};

module.exports = { generateInstalments };
