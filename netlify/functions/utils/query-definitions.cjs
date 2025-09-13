/**
 * BigQuery クエリ定義
 * 元ファイル: /Users/01062544/Documents/big-query-test/core/souke_chart_reporter.py
 * 
 * 1400+行の複雑なクエリをJavaScriptに移植
 * 主要機能:
 * - 動的日付計算
 * - チャンネル分析
 * - PDT2除外処理
 * - YoY比較
 * - 日次・累計・週次データ生成
 */

/**
 * メインの集客チャートデータ取得クエリ
 * BigQueryから集客データを取得し、Chart.js形式で返す
 */
const getSoukeChartDataQuery = () => {
  return `
    WITH
    -- 基準日計算 (動的に最新日を取得、現在月の日次データ + 週次データ用に動的期間)
    date_ranges AS (
      SELECT 
        -- 最新データ日を動的取得
        (SELECT MAX(first_determine_date) FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\` 
         WHERE first_determine_date >= DATE_TRUNC(CURRENT_DATE(), MONTH) AND first_determine_date <= CURRENT_DATE()) as latest_date,
        
        -- 動的な日次期間（前年・今年の現在月）
        DATE(EXTRACT(YEAR FROM CURRENT_DATE()) - 1, EXTRACT(MONTH FROM CURRENT_DATE()), 1) as daily_start_2024,
        LAST_DAY(DATE(EXTRACT(YEAR FROM CURRENT_DATE()) - 1, EXTRACT(MONTH FROM CURRENT_DATE()), 1)) as daily_end_2024,
        DATE_TRUNC(CURRENT_DATE(), MONTH) as daily_start_2025,
        LAST_DAY(CURRENT_DATE()) as daily_end_2025,
        -- 動的な週次期間（3ヶ月間: 2024年は前年同期間）
        DATE_TRUNC(DATE_SUB(DATE(EXTRACT(YEAR FROM CURRENT_DATE()) - 1, EXTRACT(MONTH FROM CURRENT_DATE()), 1), INTERVAL 2 MONTH), WEEK(MONDAY)) as weekly_start_2024,
        DATE_ADD(LAST_DAY(DATE(EXTRACT(YEAR FROM CURRENT_DATE()) - 1, EXTRACT(MONTH FROM CURRENT_DATE()), 1)), INTERVAL 1 DAY) as weekly_end_2024,
        DATE_TRUNC(DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 2 MONTH), WEEK(MONDAY)) as weekly_start_2025,
        LEAST(LAST_DAY(CURRENT_DATE()), CURRENT_DATE()) as weekly_end_2025
    ),
    
    -- セミナー申込完了イベント発火時の保有VOSコード（正式な業務ロジック）
    event_vos AS (
      SELECT
        evar1 AS page_url,
        post_evar39 AS entry_id,
        MIN(post_evar49) AS event_vos
      FROM \`dharma-dwh-rag.aa_rag_prt.sc_raw_datafeed_sc0197\`
      WHERE DATE(_PARTITIONTIME) >= DATE('2025-02-01')  -- 正式クエリと同じ日付
        AND evar1 LIKE '%/sf/complete.html%'
        AND post_evar39 IS NOT NULL
      GROUP BY ALL
    ),
    
    -- チャネルマスタ（正式な業務ロジック適用）
    channel_masta AS (
      SELECT
        *,
        CASE WHEN pdt2_user_flag = '1' THEN 'PDT2' ELSE 'PDT1' END as pdt_category,

        -- ラージカテゴリ修正
        CASE
          WHEN media_cd = '878' AND event_vos LIKE 'ev%' THEN "RAG有料集客"
          WHEN media_cd = '878' AND event_vos LIKE 'md%' THEN "RAG有料集客"
          ELSE channel_large_category_nm
        END AS channel_large_category_nm_v2,

        -- ミドルカテゴリ修正
        CASE 
          WHEN channel_middle_category_nm = "リスティング" AND channel_small_category_nm = "ブランド" THEN "リスティング_指名"
          WHEN channel_middle_category_nm = "リスティング" AND channel_small_category_nm = "指名" THEN "リスティング_指名"
          WHEN channel_middle_category_nm = "リスティング" AND channel_small_category_nm != "ブランド" THEN "リスティング_非指名"
          WHEN channel_middle_category_nm = "リスティング" AND channel_small_category_nm != "指名" THEN "リスティング_非指名"

          WHEN channel_middle_category_nm = "リスティング" AND vos_cd LIKE '%cm_22320697140%' THEN "リスティング_指名"
          WHEN channel_middle_category_nm = "リスティング" AND vos_cd LIKE '%cm_22330866436%' THEN "リスティング_指名"
          WHEN channel_middle_category_nm = "リスティング" AND vos_cd LIKE '%cm_22320716844%' THEN "リスティング_指名"
          WHEN channel_middle_category_nm = "リスティング" AND vos_cd LIKE '%cm_22327201577%' THEN "リスティング_指名"
          WHEN channel_middle_category_nm = "リスティング" AND vos_cd LIKE '%cm_22320744906%' THEN "リスティング_指名"

          WHEN channel_middle_category_nm = "リスティング" AND channel_small_category_nm IS NULL THEN "リスティング_非指名"

          WHEN channel_middle_category_nm = '243' THEN "運用型広告(CA指定配布)"
          WHEN channel_middle_category_nm = '244' THEN "運用型広告(CA指定配布)"
          WHEN channel_middle_category_nm = '245' THEN "運用型広告(CA指定配布)"
          WHEN channel_middle_category_nm = '246' THEN "運用型広告(CA指定配布)"
          WHEN channel_middle_category_nm = '247' THEN "運用型広告(CA指定配布)"

          WHEN channel_small_category_nm LIKE "%Indeed%" THEN "Indeed"
          WHEN channel_middle_category_nm = "その他" AND channel_large_category_nm LIKE '%RAG有料%' THEN "VOS判定不可"

          WHEN channel_middle_category_nm = "SEO" AND channel_small_category_nm = "TOPページ" THEN "SEO_TOP"
          WHEN channel_middle_category_nm = "SEO" AND channel_small_category_nm != "TOPページ" THEN "SEO_TOP以外"
          WHEN channel_middle_category_nm = "SEO" AND channel_small_category_nm IS NULL THEN "SEO_TOP以外"

          ELSE channel_middle_category_nm
        END AS channel_middle_category_nm_v2
        
      FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\`
        LEFT JOIN \`dharma-dwh-rag.agent_resource_new.t_rag_adplan_info\` adp
          USING(entry_id)
        LEFT JOIN event_vos vos
          ON (adp.adplan_info = vos.entry_id)
    ),
    
    -- RAWデータ（正式な業務ロジック + カレンダー結合）
    raw_data AS (
      SELECT
        m.first_determine_date,
        m.jobseeker_id,
        m.jobseeker_branch_id,
        m.acceptance_flag
      FROM channel_masta AS m
        LEFT JOIN \`dharma-dwh-rag.google_sheets.t_rag_hit_calendar\` e
          ON m.first_determine_date >= e.acceptance_start_date
      WHERE m.first_determine_date IS NOT NULL
      GROUP BY ALL
    ),
    
    -- PDT2除外データ
    pdt2_exclusions AS (
      SELECT
        entry_complete_date AS first_determine_date,
        jobseeker_id,
        jobseeker_branch_id,
        1 AS exclude_flg
      FROM \`dharma-dwh-rag.datamart.v_rag_entry_users_for_ro2\`
      WHERE entry_start_type = "pdt1db_to_pdt2_entry_form"
        AND entry_complete_date >= "2025-05-14"
      GROUP BY ALL
    ),
    
    -- クリーンデータ（正式な除外処理済み）
    clean_data AS (
      SELECT 
        r.first_determine_date,
        r.jobseeker_id,
        r.jobseeker_branch_id,
        r.acceptance_flag
      FROM raw_data AS r
        LEFT JOIN pdt2_exclusions AS excl
          USING(first_determine_date, jobseeker_id, jobseeker_branch_id)
      WHERE excl.exclude_flg IS NULL
    ),
    
    -- 日次データ（現在月）
    daily_data AS (
      SELECT
        first_determine_date,
        SUM(CAST(acceptance_flag AS INT64)) as daily_souke,
        EXTRACT(YEAR FROM first_determine_date) as year,
        EXTRACT(MONTH FROM first_determine_date) as month,
        EXTRACT(DAY FROM first_determine_date) as day
      FROM clean_data, date_ranges
      WHERE (
        (first_determine_date >= daily_start_2024 AND first_determine_date <= daily_end_2024) OR
        (first_determine_date >= daily_start_2025 AND first_determine_date <= daily_end_2025)
      )
      GROUP BY first_determine_date, year, month, day
      ORDER BY first_determine_date
    ),
    
    -- 累計データ計算
    cumulative_data AS (
      SELECT
        first_determine_date,
        daily_souke,
        year,
        month,
        day,
        SUM(daily_souke) OVER (
          PARTITION BY year 
          ORDER BY first_determine_date 
          ROWS UNBOUNDED PRECEDING
        ) as cumulative_souke
      FROM daily_data
    ),
    
    -- 週次データ（直近3ヶ月）
    weekly_data AS (
      SELECT
        DATE_TRUNC(first_determine_date, WEEK(MONDAY)) as week_start,
        EXTRACT(YEAR FROM first_determine_date) as year,
        EXTRACT(WEEK FROM first_determine_date) as week_number,
        SUM(CAST(acceptance_flag AS INT64)) as weekly_souke
      FROM clean_data, date_ranges
      WHERE (
        (first_determine_date >= weekly_start_2024 AND first_determine_date <= weekly_end_2024) OR
        (first_determine_date >= weekly_start_2025 AND first_determine_date <= weekly_end_2025)
      )
        AND EXTRACT(DAYOFWEEK FROM first_determine_date) != 1 -- 日曜日を除外
      GROUP BY week_start, year, week_number
      ORDER BY week_start
    )
    
    -- メイン結果セット
    SELECT
      'daily' as data_type,
      year,
      month,
      day,
      NULL as week_start,
      NULL as week_number,
      first_determine_date,
      daily_souke as souke_count,
      cumulative_souke
    FROM cumulative_data
    
    UNION ALL
    
    SELECT
      'weekly' as data_type,
      year,
      NULL as month,
      NULL as day,
      week_start,
      week_number,
      week_start as first_determine_date,
      weekly_souke as souke_count,
      NULL as cumulative_souke
    FROM weekly_data
    
    ORDER BY data_type, first_determine_date
  `;
};

/**
 * 特定日付範囲の集客データ取得クエリ
 */
const getSoukeDataForDateRange = (startDate, endDate) => {
  return `
    WITH clean_data AS (
      -- 簡略化されたデータ取得クエリ
      SELECT 
        first_determine_date,
        SUM(CAST(acceptance_flag AS INT64)) as daily_souke
      FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\`
      WHERE first_determine_date BETWEEN DATE('${startDate}') AND DATE('${endDate}')
        AND first_determine_date IS NOT NULL
      GROUP BY first_determine_date
      ORDER BY first_determine_date
    )
    
    SELECT
      first_determine_date,
      daily_souke,
      EXTRACT(YEAR FROM first_determine_date) as year,
      EXTRACT(MONTH FROM first_determine_date) as month,
      EXTRACT(DAY FROM first_determine_date) as day
    FROM clean_data
  `;
};

/**
 * 現在のデータ最新日取得クエリ
 */
const getLatestDataDate = () => {
  return `
    SELECT MAX(first_determine_date) as latest_date
    FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\`
    WHERE first_determine_date >= DATE_TRUNC(CURRENT_DATE(), MONTH) 
      AND first_determine_date <= CURRENT_DATE()
  `;
};

/**
 * データヘルスチェック用クエリ
 */
const getDataHealthCheck = () => {
  return `
    SELECT
      COUNT(*) as total_records,
      MIN(first_determine_date) as earliest_date,
      MAX(first_determine_date) as latest_date,
      COUNT(DISTINCT first_determine_date) as unique_dates
    FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\`
    WHERE first_determine_date >= DATE_TRUNC(CURRENT_DATE(), MONTH)
  `;
};

/**
 * チャネル別実績データ取得クエリ（大分類版）
 * 元のPython get_channel_breakdown(use_simple_category=True) を移植
 */
const getSoukeChannelOverviewQuery = () => {
  const query = `
    WITH
    -- 基準日計算（動的最新日取得）
    date_analysis AS (
      SELECT 
        -- 実際の最新データ日を動的取得
        (SELECT MAX(first_determine_date) FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\` 
         WHERE first_determine_date >= DATE_TRUNC(CURRENT_DATE(), MONTH) AND first_determine_date <= CURRENT_DATE()) as latest_date,
        
        -- 動的に前日・前週・前年の日付を計算
        DATE_SUB((SELECT MAX(first_determine_date) FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\` 
                  WHERE first_determine_date >= DATE_TRUNC(CURRENT_DATE(), MONTH) AND first_determine_date <= CURRENT_DATE()), INTERVAL 1 DAY) as prev_day,
        
        DATE_SUB((SELECT MAX(first_determine_date) FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\` 
                  WHERE first_determine_date >= DATE_TRUNC(CURRENT_DATE(), MONTH) AND first_determine_date <= CURRENT_DATE()), INTERVAL 7 DAY) as prev_week_day,
        
        DATE_SUB((SELECT MAX(first_determine_date) FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\` 
                  WHERE first_determine_date >= DATE_TRUNC(CURRENT_DATE(), MONTH) AND first_determine_date <= CURRENT_DATE()), INTERVAL 1 YEAR) as prev_year_day
    ),
    
    -- セミナー申込完了イベント発火時の保有VOSコード（正式な業務ロジック）
    event_vos AS (
      SELECT
        evar1 AS page_url,
        post_evar39 AS entry_id,
        MIN(post_evar49) AS event_vos
      FROM \`dharma-dwh-rag.aa_rag_prt.sc_raw_datafeed_sc0197\`
      WHERE DATE(_PARTITIONTIME) >= DATE('2025-02-01')
        AND evar1 LIKE '%/sf/complete.html%'
        AND post_evar39 IS NOT NULL
      GROUP BY ALL
    ),
    
    -- チャネルマスタ（正式な業務ロジック適用）
    channel_masta AS (
      SELECT
        *,
        CASE WHEN pdt2_user_flag = '1' THEN 'PDT2' ELSE 'PDT1' END as pdt_category,

        -- ラージカテゴリ修正
        CASE
          WHEN media_cd = '878' AND event_vos LIKE 'ev%' THEN "RAG有料集客"
          WHEN media_cd = '878' AND event_vos LIKE 'md%' THEN "RAG有料集客"
          ELSE channel_large_category_nm
        END AS channel_large_category_nm_v2,
        
        -- 簡略化チャネル分類（レポート表示用）
        CASE
          WHEN channel_large_category_nm LIKE '%RAG無料集客%' THEN 'オーガニック流入'
          WHEN channel_large_category_nm LIKE '%RAG有料集客%' THEN '有料広告流入'
          ELSE 'その他・不明'
        END AS channel_simple_category
        
      FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\`
        LEFT JOIN \`dharma-dwh-rag.agent_resource_new.t_rag_adplan_info\` adp
          USING(entry_id)
        LEFT JOIN event_vos vos
          ON (adp.adplan_info = vos.entry_id)
    ),
    
    -- PDT2除外処理
    pdt2_exclusions AS (
      SELECT
        entry_complete_date AS first_determine_date,
        jobseeker_id,
        jobseeker_branch_id,
        1 AS exclude_flg
      FROM \`dharma-dwh-rag.datamart.v_rag_entry_users_for_ro2\`
      WHERE entry_start_type = "pdt1db_to_pdt2_entry_form"
        AND entry_complete_date >= "2025-05-14"
      GROUP BY ALL
    ),
    
    -- クリーンデータ（正式な除外処理済み）
    clean_data AS (
      SELECT 
        m.first_determine_date,
        m.jobseeker_id,
        m.jobseeker_branch_id,
        m.acceptance_flag,
        m.channel_simple_category
      FROM channel_masta AS m
        LEFT JOIN pdt2_exclusions AS excl
          USING(first_determine_date, jobseeker_id, jobseeker_branch_id)
      WHERE m.first_determine_date IS NOT NULL
        AND excl.exclude_flg IS NULL
    ),
    
    -- チャネル別集計（対象期間別・動的日付使用）
    channel_metrics AS (
      SELECT
        channel_simple_category as channel_category,
        -- 当日（動的最新日）
        SUM(CASE WHEN first_determine_date = d.latest_date THEN CAST(acceptance_flag AS INT64) END) as latest_souke,
        -- 前日
        SUM(CASE WHEN first_determine_date = d.prev_day THEN CAST(acceptance_flag AS INT64) END) as prev_day_souke,
        -- 前週同日  
        SUM(CASE WHEN first_determine_date = d.prev_week_day THEN CAST(acceptance_flag AS INT64) END) as prev_week_souke,
        -- 前年同日
        SUM(CASE WHEN first_determine_date = d.prev_year_day THEN CAST(acceptance_flag AS INT64) END) as prev_year_souke
      FROM clean_data
      CROSS JOIN date_analysis d
      WHERE first_determine_date IN (d.latest_date, d.prev_day, d.prev_week_day, d.prev_year_day)
      GROUP BY channel_simple_category
    ),
    
    -- 全体合計（シェア計算用）
    total_metrics AS (
      SELECT
        SUM(latest_souke) as total_latest
      FROM channel_metrics
    )
    
    SELECT
      'channel_overview' as data_type,
      c.channel_category,
      COALESCE(c.latest_souke, 0) as latest_souke,
      COALESCE(c.prev_day_souke, 0) as prev_day_souke, 
      COALESCE(c.prev_week_souke, 0) as prev_week_souke,
      COALESCE(c.prev_year_souke, 0) as prev_year_souke,
      
      -- シェア計算
      CASE 
        WHEN t.total_latest > 0 THEN 
          ROUND(COALESCE(c.latest_souke, 0) * 100.0 / t.total_latest, 1)
        ELSE 0 
      END as share_pct,
      
      -- 成長率計算（修正版：分母が小さい場合は非表示）
      CASE 
        WHEN COALESCE(c.prev_day_souke, 0) >= 10 THEN
          ROUND(((COALESCE(c.latest_souke, 0) - COALESCE(c.prev_day_souke, 0)) * 100.0) / COALESCE(c.prev_day_souke, 0), 1)
        ELSE NULL
      END as day_growth_rate,
      
      CASE 
        WHEN COALESCE(c.prev_week_souke, 0) >= 10 THEN
          ROUND(((COALESCE(c.latest_souke, 0) - COALESCE(c.prev_week_souke, 0)) * 100.0) / COALESCE(c.prev_week_souke, 0), 1)
        ELSE NULL
      END as week_growth_rate,
      
      CASE 
        WHEN COALESCE(c.prev_year_souke, 0) >= 10 THEN
          ROUND(((COALESCE(c.latest_souke, 0) - COALESCE(c.prev_year_souke, 0)) * 100.0) / COALESCE(c.prev_year_souke, 0), 1)
        ELSE NULL
      END as year_growth_rate
      
    FROM channel_metrics c
    CROSS JOIN total_metrics t
    WHERE COALESCE(c.latest_souke, 0) > 0  -- 実績のあるチャネルのみ
    ORDER BY 
      CASE c.channel_category
        WHEN '有料広告流入' THEN 1
        WHEN 'オーガニック流入' THEN 2  
        WHEN 'その他・不明' THEN 3
        ELSE 4
      END,
      c.latest_souke DESC
  `;
  
  return query;
};

/**
 * チャネル別実績データ取得クエリ（詳細分類版）
 * 元のPython get_channel_breakdown(use_simple_category=False) を移植
 */
const getSoukeChannelDetailQuery = () => {
  const query = `
    WITH
    -- 基準日計算（動的最新日取得）
    date_analysis AS (
      SELECT 
        -- 実際の最新データ日を動的取得
        (SELECT MAX(first_determine_date) FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\` 
         WHERE first_determine_date >= DATE_TRUNC(CURRENT_DATE(), MONTH) AND first_determine_date <= CURRENT_DATE()) as latest_date,
        
        -- 動的に前日・前週・前年の日付を計算
        DATE_SUB((SELECT MAX(first_determine_date) FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\` 
                  WHERE first_determine_date >= DATE_TRUNC(CURRENT_DATE(), MONTH) AND first_determine_date <= CURRENT_DATE()), INTERVAL 1 DAY) as prev_day,
        
        DATE_SUB((SELECT MAX(first_determine_date) FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\` 
                  WHERE first_determine_date >= DATE_TRUNC(CURRENT_DATE(), MONTH) AND first_determine_date <= CURRENT_DATE()), INTERVAL 7 DAY) as prev_week_day,
        
        DATE_SUB((SELECT MAX(first_determine_date) FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\` 
                  WHERE first_determine_date >= DATE_TRUNC(CURRENT_DATE(), MONTH) AND first_determine_date <= CURRENT_DATE()), INTERVAL 1 YEAR) as prev_year_day
    ),
    
    -- セミナー申込完了イベント発火時の保有VOSコード（正式な業務ロジック）
    event_vos AS (
      SELECT
        evar1 AS page_url,
        post_evar39 AS entry_id,
        MIN(post_evar49) AS event_vos
      FROM \`dharma-dwh-rag.aa_rag_prt.sc_raw_datafeed_sc0197\`
      WHERE DATE(_PARTITIONTIME) >= DATE('2025-02-01')
        AND evar1 LIKE '%/sf/complete.html%'
        AND post_evar39 IS NOT NULL
      GROUP BY ALL
    ),
    
    -- チャネルマスタ（正式な業務ロジック適用）
    channel_masta AS (
      SELECT
        *,
        CASE WHEN pdt2_user_flag = '1' THEN 'PDT2' ELSE 'PDT1' END as pdt_category,

        -- ラージカテゴリ修正
        CASE
          WHEN media_cd = '878' AND event_vos LIKE 'ev%' THEN "RAG有料集客"
          WHEN media_cd = '878' AND event_vos LIKE 'md%' THEN "RAG有料集客"
          ELSE channel_large_category_nm
        END AS channel_large_category_nm_v2,

        -- ミドルカテゴリ修正（詳細分類）
        CASE 
          WHEN channel_middle_category_nm = "リスティング" AND channel_small_category_nm = "ブランド" THEN "リスティング_指名"
          WHEN channel_middle_category_nm = "リスティング" AND channel_small_category_nm = "指名" THEN "リスティング_指名"
          WHEN channel_middle_category_nm = "リスティング" AND channel_small_category_nm != "ブランド" THEN "リスティング_非指名"
          WHEN channel_middle_category_nm = "リスティング" AND channel_small_category_nm != "指名" THEN "リスティング_非指名"

          WHEN channel_middle_category_nm = "リスティング" AND vos_cd LIKE '%cm_22320697140%' THEN "リスティング_指名"
          WHEN channel_middle_category_nm = "リスティング" AND vos_cd LIKE '%cm_22330866436%' THEN "リスティング_指名"
          WHEN channel_middle_category_nm = "リスティング" AND vos_cd LIKE '%cm_22320716844%' THEN "リスティング_指名"
          WHEN channel_middle_category_nm = "リスティング" AND vos_cd LIKE '%cm_22327201577%' THEN "リスティング_指名"
          WHEN channel_middle_category_nm = "リスティング" AND vos_cd LIKE '%cm_22320744906%' THEN "リスティング_指名"

          WHEN channel_middle_category_nm = "リスティング" AND channel_small_category_nm IS NULL THEN "リスティング_非指名"

          WHEN channel_middle_category_nm = '243' THEN "運用型広告(CA指定配布)"
          WHEN channel_middle_category_nm = '244' THEN "運用型広告(CA指定配布)"
          WHEN channel_middle_category_nm = '245' THEN "運用型広告(CA指定配布)"
          WHEN channel_middle_category_nm = '246' THEN "運用型広告(CA指定配布)"
          WHEN channel_middle_category_nm = '247' THEN "運用型広告(CA指定配布)"

          WHEN channel_small_category_nm LIKE "%Indeed%" THEN "Indeed"
          WHEN channel_middle_category_nm = "その他" AND channel_large_category_nm LIKE '%RAG有料%' THEN "VOS判定不可"

          WHEN channel_middle_category_nm = "SEO" AND channel_small_category_nm = "TOPページ" THEN "SEO_TOP"
          WHEN channel_middle_category_nm = "SEO" AND channel_small_category_nm != "TOPページ" THEN "SEO_TOP以外"
          WHEN channel_middle_category_nm = "SEO" AND channel_small_category_nm IS NULL THEN "SEO_TOP以外"

          ELSE channel_middle_category_nm
        END AS channel_middle_category_nm_v2,
        
        -- 簡略化チャネル分類（レポート表示用）
        CASE
          WHEN channel_large_category_nm LIKE '%RAG無料集客%' THEN 'オーガニック流入'
          WHEN channel_large_category_nm LIKE '%RAG有料集客%' THEN '有料広告流入'
          ELSE 'その他・不明'
        END AS channel_simple_category
        
      FROM \`dharma-dwh-rag.datamart.t_rag_jobseeker_all\`
        LEFT JOIN \`dharma-dwh-rag.agent_resource_new.t_rag_adplan_info\` adp
          USING(entry_id)
        LEFT JOIN event_vos vos
          ON (adp.adplan_info = vos.entry_id)
    ),
    
    -- PDT2除外処理
    pdt2_exclusions AS (
      SELECT
        entry_complete_date AS first_determine_date,
        jobseeker_id,
        jobseeker_branch_id,
        1 AS exclude_flg
      FROM \`dharma-dwh-rag.datamart.v_rag_entry_users_for_ro2\`
      WHERE entry_start_type = "pdt1db_to_pdt2_entry_form"
        AND entry_complete_date >= "2025-05-14"
      GROUP BY ALL
    ),
    
    -- クリーンデータ（正式な除外処理済み）
    clean_data AS (
      SELECT 
        m.first_determine_date,
        m.jobseeker_id,
        m.jobseeker_branch_id,
        m.acceptance_flag,
        m.channel_middle_category_nm_v2,
        m.channel_simple_category
      FROM channel_masta AS m
        LEFT JOIN pdt2_exclusions AS excl
          USING(first_determine_date, jobseeker_id, jobseeker_branch_id)
      WHERE m.first_determine_date IS NOT NULL
        AND excl.exclude_flg IS NULL
    ),
    
    -- チャネル別集計（対象期間別・動的日付使用）
    channel_metrics AS (
      SELECT
        channel_middle_category_nm_v2 as channel_category,
        channel_simple_category as parent_category,
        -- 当日（動的最新日）
        SUM(CASE WHEN first_determine_date = d.latest_date THEN CAST(acceptance_flag AS INT64) END) as latest_souke,
        -- 前日
        SUM(CASE WHEN first_determine_date = d.prev_day THEN CAST(acceptance_flag AS INT64) END) as prev_day_souke,
        -- 前週同日  
        SUM(CASE WHEN first_determine_date = d.prev_week_day THEN CAST(acceptance_flag AS INT64) END) as prev_week_souke,
        -- 前年同日
        SUM(CASE WHEN first_determine_date = d.prev_year_day THEN CAST(acceptance_flag AS INT64) END) as prev_year_souke
      FROM clean_data
      CROSS JOIN date_analysis d
      WHERE first_determine_date IN (d.latest_date, d.prev_day, d.prev_week_day, d.prev_year_day)
      GROUP BY channel_middle_category_nm_v2, channel_simple_category
    ),
    
    -- 全体合計（シェア計算用）
    total_metrics AS (
      SELECT
        SUM(latest_souke) as total_latest
      FROM channel_metrics
    )
    
    SELECT
      'channel_detail' as data_type,
      c.channel_category,
      c.parent_category,
      COALESCE(c.latest_souke, 0) as latest_souke,
      COALESCE(c.prev_day_souke, 0) as prev_day_souke, 
      COALESCE(c.prev_week_souke, 0) as prev_week_souke,
      COALESCE(c.prev_year_souke, 0) as prev_year_souke,
      
      -- シェア計算
      CASE 
        WHEN t.total_latest > 0 THEN 
          ROUND(COALESCE(c.latest_souke, 0) * 100.0 / t.total_latest, 1)
        ELSE 0 
      END as share_pct,
      
      -- 成長率計算（修正版：分母が小さい場合は非表示）
      CASE 
        WHEN COALESCE(c.prev_day_souke, 0) >= 5 THEN
          ROUND(((COALESCE(c.latest_souke, 0) - COALESCE(c.prev_day_souke, 0)) * 100.0) / COALESCE(c.prev_day_souke, 0), 1)
        ELSE NULL
      END as day_growth_rate,
      
      CASE 
        WHEN COALESCE(c.prev_week_souke, 0) >= 5 THEN
          ROUND(((COALESCE(c.latest_souke, 0) - COALESCE(c.prev_week_souke, 0)) * 100.0) / COALESCE(c.prev_week_souke, 0), 1)
        ELSE NULL
      END as week_growth_rate,
      
      CASE 
        WHEN COALESCE(c.prev_year_souke, 0) >= 5 THEN
          ROUND(((COALESCE(c.latest_souke, 0) - COALESCE(c.prev_year_souke, 0)) * 100.0) / COALESCE(c.prev_year_souke, 0), 1)
        ELSE NULL
      END as year_growth_rate
      
    FROM channel_metrics c
    CROSS JOIN total_metrics t
    WHERE COALESCE(c.latest_souke, 0) > 0  -- 実績のあるチャネルのみ
    ORDER BY 
      CASE c.parent_category 
        WHEN '有料広告流入' THEN 1
        WHEN 'オーガニック流入' THEN 2  
        WHEN 'その他・不明' THEN 3
        ELSE 4
      END,
      c.latest_souke DESC
  `;
  
  return query;
};

/**
 * 週次内定数データ取得クエリ（総受データと同じ期間設定）
 */
const getNaiteiWeeklyDataQuery = () => {
  return `
    /*
    ----------------------------------------
    週次内定数（内定件数）集計（前年同週比較対応版）
    動的期間設定：現在月を含む3ヶ月間の週次データ
    ----------------------------------------
    */
    WITH
    -- 期間パラメータ定義（動的期間設定）
    date_ranges AS (
      SELECT 
        -- 動的週次期間（前年同期間：3ヶ月間）
        DATE_TRUNC(DATE_SUB(DATE(EXTRACT(YEAR FROM CURRENT_DATE()) - 1, EXTRACT(MONTH FROM CURRENT_DATE()), 1), INTERVAL 2 MONTH), WEEK(MONDAY)) as weekly_start_2024,
        DATE_ADD(LAST_DAY(DATE(EXTRACT(YEAR FROM CURRENT_DATE()) - 1, EXTRACT(MONTH FROM CURRENT_DATE()), 1)), INTERVAL 1 DAY) as weekly_end_2024,
        -- 今年の期間（現在月から3ヶ月前まで）
        DATE_TRUNC(DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 2 MONTH), WEEK(MONDAY)) as weekly_start_2025,
        -- 動的に現在日まで取得
        CURRENT_DATE() as weekly_end_2025
    ),

    -- 本年＋昨年分をまとめて週次内定数集計
    weekly_naitei AS (
      SELECT
        DATE_TRUNC(DATE(prospective_date), WEEK(MONDAY)) AS week_start_date,
        EXTRACT(ISOYEAR FROM DATE(prospective_date)) AS iso_year,
        EXTRACT(ISOWEEK FROM DATE(prospective_date)) AS iso_week,
        SUM(prospective_f) AS offer_count
      FROM
        \`dharma-dwh-rag.legacy_datamart.v_rag_flow_action_detail_joboffer\`
      WHERE
        -- 本年：動的3ヶ月間
        ( DATE(prospective_date) >= (SELECT weekly_start_2025 FROM date_ranges)
          AND DATE(prospective_date) <= (SELECT weekly_end_2025 FROM date_ranges) )
        OR
        -- 昨年：同期間
        ( DATE(prospective_date) >= (SELECT weekly_start_2024 FROM date_ranges)
          AND DATE(prospective_date) <= (SELECT weekly_end_2024 FROM date_ranges) )
      GROUP BY
        week_start_date, iso_year, iso_week
    ),

    -- 本年の動的期間分のみ抽出
    current_weeks AS (
      SELECT
        week_start_date,
        iso_year,
        iso_week,
        offer_count AS offer_count_current
      FROM
        weekly_naitei
      WHERE
        week_start_date >= (SELECT weekly_start_2025 FROM date_ranges)
        AND week_start_date <= (SELECT weekly_end_2025 FROM date_ranges)
    )

    -- 前年同週の件数を紐付け
    SELECT
      cw.week_start_date AS week_start_date,
      cw.offer_count_current AS offer_count_current,
      COALESCE(py.offer_count, 0) AS offer_count_last_year
    FROM
      current_weeks AS cw
    LEFT JOIN
      weekly_naitei AS py
    ON
      py.iso_year = cw.iso_year - 1
      AND py.iso_week = cw.iso_week
    ORDER BY
      cw.week_start_date;
  `;
};

/**
 * 日次内定数データ取得クエリ（総受データと同じ期間設定）
 */
const getNaiteiDailyDataQuery = () => {
  return `
    /*
    ----------------------------------------
    日次内定数（内定件数）集計（カレンダー基準JOIN修正版）
    ----------------------------------------
    */
    WITH
    -- 本年+昨年の日次内定数集計（完全独立取得）
    daily_naitei AS (
      SELECT
        DATE(prospective_date) AS offer_date,
        EXTRACT(YEAR FROM DATE(prospective_date)) AS year,
        SUM(prospective_f) AS daily_naitei_count
      FROM \`dharma-dwh-rag.legacy_datamart.v_rag_flow_action_detail_joboffer\`
      WHERE
        prospective_f = 1
        AND (
          -- 本年：現在月（実データまで）
          ( DATE(prospective_date) >= DATE_TRUNC(CURRENT_DATE(), MONTH)
            AND DATE(prospective_date) <= CURRENT_DATE() )
          OR
          -- 前年：同月全体（完全独立取得）
          ( DATE(prospective_date) >= DATE(EXTRACT(YEAR FROM CURRENT_DATE()) - 1, EXTRACT(MONTH FROM CURRENT_DATE()), 1)
            AND DATE(prospective_date) <= LAST_DAY(DATE(EXTRACT(YEAR FROM CURRENT_DATE()) - 1, EXTRACT(MONTH FROM CURRENT_DATE()), 1)) )
        )
      GROUP BY offer_date, year
    ),

    -- カレンダー生成（2025年の日付基準）
    calendar AS (
      SELECT 
        date_val as offer_date,
        DATE_SUB(date_val, INTERVAL 1 YEAR) as prev_year_date
      FROM 
        UNNEST(GENERATE_DATE_ARRAY(
          DATE_TRUNC(CURRENT_DATE(), MONTH), 
          LAST_DAY(CURRENT_DATE())
        )) AS date_val
    )

    -- メイン結果（現在日以降は空白、総受と同じ表示）
    SELECT
      c.offer_date,
      CASE 
        WHEN c.offer_date <= CURRENT_DATE() THEN COALESCE(curr.daily_naitei_count, 0)
        ELSE NULL 
      END AS offer_count_current,
      COALESCE(prev.daily_naitei_count, 0) AS offer_count_last_year
    FROM calendar c
    LEFT JOIN daily_naitei curr 
      ON curr.offer_date = c.offer_date AND curr.year = EXTRACT(YEAR FROM CURRENT_DATE())
    LEFT JOIN daily_naitei prev 
      ON prev.offer_date = c.prev_year_date AND prev.year = EXTRACT(YEAR FROM CURRENT_DATE()) - 1
    ORDER BY c.offer_date;
  `;
};

/**
 * 累計内定数データ取得クエリ（KPIクエリと同一構造）
 */
const getNaiteiCumulativeDataQuery = () => {
  return `
    /*
    ----------------------------------------
    累計内定数（内定件数）集計（カレンダー基準JOIN修正版）
    ----------------------------------------
    */
    WITH
    -- 本年+昨年の日次内定数集計（完全独立取得）
    daily_naitei AS (
      SELECT
        DATE(prospective_date) AS offer_date,
        EXTRACT(YEAR FROM DATE(prospective_date)) AS year,
        SUM(prospective_f) AS daily_naitei_count
      FROM \`dharma-dwh-rag.legacy_datamart.v_rag_flow_action_detail_joboffer\`
      WHERE
        prospective_f = 1
        AND (
          -- 本年：現在月（実データまで）
          ( DATE(prospective_date) >= DATE_TRUNC(CURRENT_DATE(), MONTH)
            AND DATE(prospective_date) <= CURRENT_DATE() )
          OR
          -- 前年：同月全体（完全独立取得）
          ( DATE(prospective_date) >= DATE(EXTRACT(YEAR FROM CURRENT_DATE()) - 1, EXTRACT(MONTH FROM CURRENT_DATE()), 1)
            AND DATE(prospective_date) <= LAST_DAY(DATE(EXTRACT(YEAR FROM CURRENT_DATE()) - 1, EXTRACT(MONTH FROM CURRENT_DATE()), 1)) )
        )
      GROUP BY offer_date, year
    ),

    -- カレンダー生成（月末まで生成で2024年データも完全表示）
    calendar_both_years AS (
      SELECT 
        date_val as offer_date,
        EXTRACT(YEAR FROM date_val) as year,
        DATE_SUB(date_val, INTERVAL 1 YEAR) as prev_year_date
      FROM 
        UNNEST(GENERATE_DATE_ARRAY(
          DATE_TRUNC(CURRENT_DATE(), MONTH), 
          LAST_DAY(CURRENT_DATE())
        )) AS date_val
      UNION ALL
      SELECT 
        DATE_ADD(date_val, INTERVAL 1 YEAR) as offer_date,
        EXTRACT(YEAR FROM DATE_ADD(date_val, INTERVAL 1 YEAR)) as year,
        date_val as prev_year_date
      FROM 
        UNNEST(GENERATE_DATE_ARRAY(
          DATE(EXTRACT(YEAR FROM CURRENT_DATE()) - 1, EXTRACT(MONTH FROM CURRENT_DATE()), 1),
          LAST_DAY(DATE(EXTRACT(YEAR FROM CURRENT_DATE()) - 1, EXTRACT(MONTH FROM CURRENT_DATE()), 1))
        )) AS date_val
    ),

    -- 全日付に日次データをJOIN（ない日は0）
    daily_with_calendar AS (
      SELECT
        c.offer_date,
        c.year,
        COALESCE(d.daily_naitei_count, 0) as daily_naitei_count
      FROM calendar_both_years c
      LEFT JOIN daily_naitei d 
        ON c.offer_date = d.offer_date AND c.year = d.year
    ),

    -- 累計計算（全日付連続で計算）
    cumulative_naitei AS (
      SELECT
        offer_date,
        year,
        daily_naitei_count,
        SUM(daily_naitei_count) OVER (
          PARTITION BY year
          ORDER BY offer_date
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS cumulative_count
      FROM daily_with_calendar
    ),

    -- 2025年基準カレンダー（表示用）
    calendar AS (
      SELECT 
        date_val as offer_date,
        DATE_SUB(date_val, INTERVAL 1 YEAR) as prev_year_date
      FROM 
        UNNEST(GENERATE_DATE_ARRAY(
          DATE_TRUNC(CURRENT_DATE(), MONTH), 
          LAST_DAY(CURRENT_DATE())
        )) AS date_val
    )

    -- メイン結果（現在日以降は空白、累計は年次計算）
    SELECT
      c.offer_date,
      CASE 
        WHEN c.offer_date <= CURRENT_DATE() THEN curr.cumulative_count
        ELSE NULL 
      END AS offer_count_current,
      prev.cumulative_count AS offer_count_last_year
    FROM calendar c
    LEFT JOIN cumulative_naitei curr 
      ON curr.offer_date = c.offer_date AND curr.year = EXTRACT(YEAR FROM CURRENT_DATE())
    LEFT JOIN cumulative_naitei prev 
      ON prev.offer_date = c.prev_year_date AND prev.year = EXTRACT(YEAR FROM CURRENT_DATE()) - 1
    ORDER BY c.offer_date;
  `;
};

/**
 * 内定数KPIデータ取得クエリ（総受KPIと同様の構造）
 * 前日比・前週比・前年比の計算ロジック込み
 */
const getNaiteiKpiDataQuery = () => {
  return `
    WITH
    date_analysis AS (
      SELECT 
        -- 実際の最新データ日を動的取得（内定数テーブルから）
        (SELECT MAX(DATE(prospective_date)) FROM \`dharma-dwh-rag.legacy_datamart.v_rag_flow_action_detail_joboffer\` 
         WHERE DATE(prospective_date) >= DATE_TRUNC(CURRENT_DATE(), MONTH) AND DATE(prospective_date) <= CURRENT_DATE()) as latest_date,
        
        -- 動的に前日・前週・前年の日付を計算
        DATE_SUB((SELECT MAX(DATE(prospective_date)) FROM \`dharma-dwh-rag.legacy_datamart.v_rag_flow_action_detail_joboffer\` 
                  WHERE DATE(prospective_date) >= DATE_TRUNC(CURRENT_DATE(), MONTH) AND DATE(prospective_date) <= CURRENT_DATE()), INTERVAL 1 DAY) as prev_day,
        
        DATE_SUB((SELECT MAX(DATE(prospective_date)) FROM \`dharma-dwh-rag.legacy_datamart.v_rag_flow_action_detail_joboffer\` 
                  WHERE DATE(prospective_date) >= DATE_TRUNC(CURRENT_DATE(), MONTH) AND DATE(prospective_date) <= CURRENT_DATE()), INTERVAL 7 DAY) as prev_week_day,
        
        DATE_SUB((SELECT MAX(DATE(prospective_date)) FROM \`dharma-dwh-rag.legacy_datamart.v_rag_flow_action_detail_joboffer\` 
                  WHERE DATE(prospective_date) >= DATE_TRUNC(CURRENT_DATE(), MONTH) AND DATE(prospective_date) <= CURRENT_DATE()), INTERVAL 1 YEAR) as prev_year_day
    ),
    
    daily_naitei AS (
      SELECT 
        DATE(prospective_date) as offer_date,
        SUM(prospective_f) as daily_naitei_count
      FROM \`dharma-dwh-rag.legacy_datamart.v_rag_flow_action_detail_joboffer\`
      WHERE DATE(prospective_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 400 DAY)
        AND prospective_date IS NOT NULL
      GROUP BY DATE(prospective_date)
    )
    
    SELECT
      d.latest_date,
      COALESCE(latest.daily_naitei_count, 0) as latest_naitei,
      COALESCE(prev_day.daily_naitei_count, 0) as prev_day_naitei,
      COALESCE(prev_week.daily_naitei_count, 0) as prev_week_naitei,
      COALESCE(prev_year.daily_naitei_count, 0) as prev_year_naitei,
      
      -- 成長率計算（総受と同じ計算式）
      CASE 
        WHEN COALESCE(prev_day.daily_naitei_count, 0) > 0 THEN
          ROUND(((COALESCE(latest.daily_naitei_count, 0) - COALESCE(prev_day.daily_naitei_count, 0)) * 100.0) / COALESCE(prev_day.daily_naitei_count, 0), 1)
        ELSE NULL
      END as day_growth_rate,
      
      CASE 
        WHEN COALESCE(prev_week.daily_naitei_count, 0) > 0 THEN
          ROUND(((COALESCE(latest.daily_naitei_count, 0) - COALESCE(prev_week.daily_naitei_count, 0)) * 100.0) / COALESCE(prev_week.daily_naitei_count, 0), 1)
        ELSE NULL
      END as week_growth_rate,
      
      CASE 
        WHEN COALESCE(prev_year.daily_naitei_count, 0) > 0 THEN
          ROUND(((COALESCE(latest.daily_naitei_count, 0) - COALESCE(prev_year.daily_naitei_count, 0)) * 100.0) / COALESCE(prev_year.daily_naitei_count, 0), 1)
        ELSE NULL
      END as year_growth_rate
      
    FROM date_analysis d
    LEFT JOIN daily_naitei latest ON d.latest_date = latest.offer_date
    LEFT JOIN daily_naitei prev_day ON d.prev_day = prev_day.offer_date
    LEFT JOIN daily_naitei prev_week ON d.prev_week_day = prev_week.offer_date
    LEFT JOIN daily_naitei prev_year ON d.prev_year_day = prev_year.offer_date
  `;
};

module.exports = {
  getSoukeChartDataQuery,
  getSoukeDataForDateRange,
  getLatestDataDate,
  getDataHealthCheck,
  getSoukeChannelOverviewQuery,
  getSoukeChannelDetailQuery,
  getNaiteiWeeklyDataQuery,
  getNaiteiDailyDataQuery,
  getNaiteiCumulativeDataQuery,
  getNaiteiKpiDataQuery
};
