-- =====================================================================
-- AERSA Copilot · TALOS · SQL view definitions
-- Idempotent: every view is `CREATE OR REPLACE`.
-- These views encode the data-quality contract from CLAUDE.md §3.4.
-- =====================================================================

-- ─── inventariomesdetalle_clean ───────────────────────────────────────
-- Base filtered view. ALWAYS use this, never raw inventariomesdetalle.
-- Filters: known corrupt row + outlier thresholds + non-negative stock.
CREATE OR REPLACE VIEW inventariomesdetalle_clean AS
SELECT *
FROM inventariomesdetalle
WHERE idinventariomesdetalle <> 90806848                  -- known corrupt row
  AND inventariomesdetalle_stockfisico  < 1e7
  AND inventariomesdetalle_importefisico < 1e8
  AND inventariomesdetalle_stockfisico  >= 0;


-- ─── inventario_full ──────────────────────────────────────────────────
-- Joins clean detail with inventory header for everyday analytical reads.
-- Only includes inventories in a "useful" status (per CLAUDE.md §6.1).
-- All amounts are MXN; periodo is the YYYY-MM anchor of the Cierre.
CREATE OR REPLACE VIEW inventario_full AS
SELECT
    d.idinventariomesdetalle,
    d.idinventariomes,
    d.idproducto,
    m.idalmacen,
    m.idempresa,
    m.idsucursal,
    m.inventariomes_fecha                       AS fecha,
    DATE_FORMAT(m.inventariomes_fecha, '%Y-%m') AS periodo,
    d.inventariomesdetalle_stockinicial         AS stock_inicial,
    d.inventariomesdetalle_stockteorico         AS stock_teorico,
    d.inventariomesdetalle_stockfisico          AS stock_fisico,
    d.inventariomesdetalle_diferencia           AS diferencia,
    d.inventariomesdetalle_ingresocompra        AS ingreso_compra,
    d.inventariomesdetalle_egresoventa          AS egreso_venta,
    d.inventariomesdetalle_ingresorequisicion   AS ingreso_req,
    d.inventariomesdetalle_egresorequisicion    AS egreso_req,
    d.inventariomesdetalle_reajuste             AS reajuste,
    d.inventariomesdetalle_costopromedio        AS costo_promedio,
    d.inventariomesdetalle_importefisico        AS importe_fisico,
    d.inventariomesdetalle_difimporte           AS dif_importe,
    m.inventariomes_estatus                     AS estatus
FROM inventariomesdetalle_clean d
JOIN inventariomes m ON d.idinventariomes = m.idinventariomes
WHERE m.inventariomes_estatus IN ('finalizado', 'aplicado', 'terminado');
