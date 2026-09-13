from evals.run_evals import evaluate


def test_golden_retrieval_recall_and_constraints():
    metrics = evaluate()
    assert metrics["recall_at_5"] >= 0.80
    assert metrics["constraint_pass_rate"] == 1.0
