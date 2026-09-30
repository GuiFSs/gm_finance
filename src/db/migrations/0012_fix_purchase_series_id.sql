-- Repara series_id da 0011: parcelas do mesmo lançamento (critério antigo) passam a
-- compartilhar o id da 1ª parcela. Só toca grupos ainda fragmentados (vários series_id).
-- Compras já criadas com series_id compartilhado na app não são alteradas se já estão ok.

UPDATE `purchases`
SET `series_id` = (
  SELECT `p2`.`id`
  FROM `purchases` AS `p2`
  WHERE `p2`.`title` = `purchases`.`title`
    AND `p2`.`payment_source_type` = `purchases`.`payment_source_type`
    AND `p2`.`installment_count` = `purchases`.`installment_count`
    AND `p2`.`created_by_user_id` = `purchases`.`created_by_user_id`
    AND (
      (`p2`.`payment_source_id` IS NULL AND `purchases`.`payment_source_id` IS NULL)
      OR `p2`.`payment_source_id` = `purchases`.`payment_source_id`
    )
  ORDER BY `p2`.`installment_number` ASC, `p2`.`purchase_date` ASC, `p2`.`id` ASC
  LIMIT 1
)
WHERE `installment_count` > 1
  AND (
    SELECT count(DISTINCT `p3`.`series_id`)
    FROM `purchases` AS `p3`
    WHERE `p3`.`title` = `purchases`.`title`
      AND `p3`.`payment_source_type` = `purchases`.`payment_source_type`
      AND `p3`.`installment_count` = `purchases`.`installment_count`
      AND `p3`.`created_by_user_id` = `purchases`.`created_by_user_id`
      AND (
        (`p3`.`payment_source_id` IS NULL AND `purchases`.`payment_source_id` IS NULL)
        OR `p3`.`payment_source_id` = `purchases`.`payment_source_id`
      )
  ) > 1;
