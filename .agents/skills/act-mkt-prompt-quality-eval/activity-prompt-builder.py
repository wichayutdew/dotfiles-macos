"""
Activity Content Enhancement Prompt Builder (PySpark)

Queries agoda_activities.activity_details from Hadoop, extracts fields from the
nested JSON `details` column, and constructs prompts in the exact SEOGPT
ActivityProductAssistant format for 3 components (title, description, product-information).

Usage in PySpark notebook/shell:
    %run activity-prompt-builder.py

    ACTIVITY_IDS = [984803, 698348]
    df = fetch_activity_details(spark, ACTIVITY_IDS)

    # English only (default)
    prompts_df = build_prompt_df(spark, df)
    prompts_df.show(truncate=80)
    preview_prompt(prompts_df, activity_id=984803, component="product-information")

    # Multiple target languages
    TARGET_LANGUAGE_IDS = [1, 6, 7, 9, 22, 26]  # EN, JP, T.CN, KR, TH, ID
    prompts_df = build_prompt_df(spark, df)
    preview_prompt(prompts_df, activity_id=984803, component="title", target_language_id=6)
"""

import json
from pyspark.sql import SparkSession, DataFrame, Row
from pyspark.sql import functions as F

# ===========================================================================
# USER CONFIGURATION — edit these to customise prompt generation
# ===========================================================================

# Target language IDs for content enhancement.
# Source content is always English (language_id=1) from Hadoop.
# Each target language generates a separate prompt with the corresponding
# language name in the <language> tag.
TARGET_LANGUAGE_IDS = [1]  # English only by default; add more as needed, e.g.:
# TARGET_LANGUAGE_IDS = [1, 6, 7, 9, 22, 26]  # English, Japanese, T.Chinese, Korean, Thai, Indonesian

# ===========================================================================
# INTERNAL CONFIGURATION — change less often
# ===========================================================================

# ---------------------------------------------------------------------------
# User prompt template.
# Placeholders: {details}, {metadata}, {language} — substituted at runtime.
# Edit the structure freely to match your desired prompt format.
# ---------------------------------------------------------------------------
USER_PROMPT_TEMPLATE = """\
<Input>
<parameters>
<details><![CDATA[{details}]]></details>
<metadata><![CDATA[{metadata}]]></metadata>
<language><![CDATA[{language}]]></language>
</parameters>
</Input>"""

# ---------------------------------------------------------------------------
# 1. Component -> field mapping (uses gRPC field names from ActivityContentReadInjector)
#    Users configure components using these gRPC names. The GRPC_TO_HADOOP_MAP
#    below translates them to the actual Hadoop JSON paths at runtime.
#
#    Note: In the gRPC response, inclusionRefs and exclusionRefs are separate
#    top-level arrays. In the Hadoop table (agoda_activities.activity_details),
#    inclusions and exclusions live inside offers[].benefits[] at the offer level,
#    not the activity level. They are mapped via "offers" in Hadoop.
# ---------------------------------------------------------------------------
COMPONENT_FIELDS = {
    "title": [
        "activityInfo.title",
    ],
    "description": [
        "activityInfo.title",
        "activityInfo.description",
        "supplierInfo.providerName",
    ],
    "product-information": [
        "activityInfo.title",
        "activityInfo.description",
        "supplierInfo.providerName",
        # additionalInfoList is offer-level data in Hadoop
        # (offers[].additional_infos[]), not an activity-level field.
        # The script collects entries across all offers.
        "additionalInfoList",
        "imageList",
        # inclusionRefs/exclusionRefs are offer-level data in Hadoop
        # (offers[].benefits[].benefit_type = "INCLUSION"/"EXCLUSION"),
        # not activity-level arrays like in the gRPC response.
        # The script extracts and reshapes them into the gRPC format.
        "inclusionRefs",
        "exclusionRefs",
        "genericSection",
    ],
}

# ---------------------------------------------------------------------------
# 1b. gRPC field name -> Hadoop JSON path mapping
#     The Hadoop table (agoda_activities.activity_details) uses flat snake_case
#     keys, while the gRPC response (ActivityContentReadInjector) uses nested
#     camelCase. This map bridges the two so users can configure COMPONENT_FIELDS
#     with the familiar gRPC names.
#
#     Fields not listed here are assumed to exist as-is in the Hadoop JSON.
# ---------------------------------------------------------------------------
GRPC_TO_HADOOP_MAP = {
    # Activity headline shown on the listing/detail page
    "activityInfo.title":       "activity_title",
    # Full HTML/text description of the activity experience
    "activityInfo.description": "activity_description",
    # Name of the content supplier (e.g., "Viator", "Bcom", "Kkday")
    "supplierInfo.providerName": "provider_contact.provider_name",
    # Gallery images with URLs at multiple resolutions (alt text, captions)
    "imageList":                "images",
    # Free-form info sections (e.g., "Know before you go", "What to expect")
    # Often empty ([]) in Hadoop — most content lives in offers
    "genericSection":           "activity_infos",
    # Additional info items (e.g., "Know before you go", important notices)
    # In Hadoop these are offer-level: offers[].additional_infos[]
    # Collected across all offers by _extract_additional_infos_from_offers()
    "additionalInfoList":       "__additional_infos",
    # What's included (e.g., "Hotel pickup", "Bottled water", "Insurance")
    # In Hadoop these are offer-level: offers[].benefits[] with benefit_type = "INCLUSION"
    # Reshaped into gRPC format by _extract_benefits_from_offers()
    "inclusionRefs":            "__benefits:INCLUSION",
    # What's NOT included (e.g., "Tips", "Food and drinks", "Personal expenses")
    # Same offer-level source as inclusionRefs, filtered by benefit_type = "EXCLUSION"
    "exclusionRefs":            "__benefits:EXCLUSION",
}

# ---------------------------------------------------------------------------
# 2. Language mapping (language_id -> language name used in the prompt)
# ---------------------------------------------------------------------------
# Source: SELECT language_id, language_name FROM bi_dw.dim_language WHERE rec_status = 1
LANGUAGE_MAP = {
    1: "English",
    2: "French",
    3: "German",
    4: "Italian",
    5: "Spanish",
    6: "Japanese",
    7: "T.Chinese / Hongkong",
    8: "S.Chinese / Mainland",
    9: "Korean",
    10: "Greek",
    11: "Russian",
    12: "Portuguese",
    13: "Dutch",
    14: "English / Canada",
    15: "English / India",
    16: "English / United Kingdom",
    17: "English / South-Africa",
    18: "English / Australia",
    19: "English / Singapore",
    20: "T. Chinese / Taiwan",
    21: "English / New Zealand",
    22: "Thai",
    23: "Malay",
    24: "Vietnamese",
    25: "Swedish",
    26: "Indonesian",
    27: "Polish",
    28: "Norwegian",
    29: "Danish",
    30: "Finnish",
    31: "Czech",
    32: "Turkish",
    33: "Catalan",
    34: "Hungarian",
    36: "Bulgarian",
    37: "Romanian",
    38: "Slovenian",
    39: "Hebrew",
    40: "Arabic",
    41: "Dutch / Belgium",
    42: "English / Ireland",
    43: "Portuguese / Brazil",
    44: "Spanish / Argentina",
    45: "Spanish / Mexico",
    46: "Lithuanian",
    47: "Latvian",
    48: "Croatian",
    49: "Estonian",
    50: "Ukrainian",
    51: "Filipino",
    52: "French / Canada",
}

# ---------------------------------------------------------------------------
# 3. Geo dimension tables used for metadata
# ---------------------------------------------------------------------------
GEO_CITY_TABLE = "bi_dw.dim_city"
GEO_COUNTRY_TABLE = "bi_dw.dim_country"


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------

def fetch_activity_details(spark, activity_ids):
    """Fetch raw English activity details from Hadoop.

    Source content is always English (language_id=1). Target languages for
    enhancement are configured via TARGET_LANGUAGE_IDS.

    Equivalent StarRocks SQL:
        SELECT activityid, languageid, details
        FROM agoda_activities.activity_details
        WHERE activityid IN (984803, 698348)
          AND languageid = 1;

    Args:
        spark: SparkSession
        activity_ids: list of int activity IDs

    Returns:
        DataFrame with columns: activityid, languageid, details
    """
    ids_str = ", ".join(str(int(aid)) for aid in activity_ids)
    query = (
        "SELECT activityid, languageid, details "
        "FROM agoda_activities.activity_details "
        f"WHERE activityid IN ({ids_str}) "
        "AND languageid = 1"
    )
    return spark.sql(query)


def fetch_geo_metadata(spark, details_df):
    """Enrich details DataFrame with geo metadata JSON.

    Extracts cityId and countryId from the details JSON, joins with geo
    dimension tables, and adds a `metadata_json` column in the format:
        {"geoLocation":{"cityName":"...","countryName":"...","countryISO2":"..."}}

    Equivalent StarRocks SQL:
        SELECT
            ad.activityid,
            ad.languageid,
            ad.details,
            CONCAT('{"geoLocation":{"cityName":"', IFNULL(c.city_name, ''),
                   '","countryName":"', IFNULL(co.country_name, ''),
                   '","countryISO2":"', IFNULL(co.country_iso2, ''), '"}}') AS metadata_json
        FROM agoda_activities.activity_details ad
        LEFT JOIN bi_dw.dim_city c
            ON CAST(get_json_string(ad.details, '$.geo_info.cityId') AS INT) = c.city_id
        LEFT JOIN bi_dw.dim_country co
            ON CAST(get_json_string(ad.details, '$.geo_info.countryId') AS INT) = co.country_id
        WHERE ad.activityid IN (984803, 698348)
          AND ad.languageid = 1;

    Args:
        spark: SparkSession
        details_df: DataFrame with `details` column (JSON string)

    Returns:
        DataFrame with original columns plus `metadata_json`
    """
    enriched = details_df.withColumn(
        "city_id",
        F.get_json_object(F.col("details"), "$.geo_info.cityId").cast("int"),
    ).withColumn(
        "country_id",
        F.get_json_object(F.col("details"), "$.geo_info.countryId").cast("int"),
    )

    # spark.table() is equivalent to sqlContext.table() in PySpark.
    # If your notebook exposes sqlContext, you can also use:
    #   city_df = sqlContext.table(GEO_CITY_TABLE).select(...)
    city_df = spark.table(GEO_CITY_TABLE).select(
        F.col("city_id"),
        F.col("city_name"),
    )
    country_df = spark.table(GEO_COUNTRY_TABLE).select(
        F.col("country_id"),
        F.col("country_name"),
        F.col("country_iso2"),
    )

    joined = (
        enriched
        .join(city_df, "city_id", "left")
        .join(country_df, "country_id", "left")
    )

    # Build metadata JSON string
    joined = joined.withColumn(
        "metadata_json",
        F.to_json(
            F.struct(
                F.struct(
                    F.col("city_name").alias("cityName"),
                    F.col("country_name").alias("countryName"),
                    F.col("country_iso2").alias("countryISO2"),
                ).alias("geoLocation")
            )
        ),
    )

    # Drop intermediate columns
    return joined.drop("city_id", "country_id", "city_name", "country_name", "country_iso2")


def _resolve_hadoop_path(grpc_field):
    """Translate a gRPC field name to its Hadoop JSON path via GRPC_TO_HADOOP_MAP.

    Returns the Hadoop path if mapped, otherwise returns the field as-is.
    Special prefix "__benefits:" signals benefit extraction from offers.
    """
    return GRPC_TO_HADOOP_MAP.get(grpc_field, grpc_field)


def _extract_field(details, hadoop_path):
    """Extract a value from the parsed details dict using a Hadoop JSON path.

    Supports:
    - Dot-notation for nested fields (e.g., "provider_contact.provider_name")
    - Plain keys for top-level fields (e.g., "images")
    - "__benefits:TYPE" for extracting inclusion/exclusion from offers[].benefits[]
    """
    if hadoop_path.startswith("__benefits:"):
        benefit_type = hadoop_path.split(":")[1]
        return _extract_benefits_from_offers(details, benefit_type)
    elif hadoop_path == "__additional_infos":
        return _extract_additional_infos_from_offers(details)
    elif "." in hadoop_path:
        parts = hadoop_path.split(".")
        node = details
        for part in parts:
            if isinstance(node, dict) and part in node:
                node = node[part]
            else:
                return None
        return node
    else:
        return details.get(hadoop_path)


def _collect_from_offers(details, field_name, filter_fn=None, transform_fn=None):
    """Collect items from an offer-level array field across all offers.

    Iterates offers[].{field_name}[], optionally filtering and transforming
    each item. Returns None if no items are collected.

    Args:
        details: parsed details dict
        field_name: key within each offer to extract (e.g., "benefits", "additional_infos")
        filter_fn: optional predicate — item is skipped if this returns False
        transform_fn: optional mapper — applied to each item before collecting
    """
    offers = details.get("offers")
    if not offers or not isinstance(offers, list):
        return None

    collected = []
    for offer in offers:
        items = offer.get(field_name)
        if not items or not isinstance(items, list):
            continue
        for item in items:
            if filter_fn and not filter_fn(item):
                continue
            collected.append(transform_fn(item) if transform_fn else item)

    return collected if collected else None


def _extract_benefits_from_offers(details, benefit_type):
    """Extract and reshape offer-level benefits into gRPC inclusionRefs/exclusionRefs format.

    Hadoop: offers[].benefits[] with benefit_type = "INCLUSION" or "EXCLUSION"
    gRPC:   inclusionRefs/exclusionRefs = [{"benefits": [...], "id": 0}]
    """
    collected = _collect_from_offers(
        details,
        "benefits",
        filter_fn=lambda b: b.get("benefit_type") == benefit_type and b.get("benefit_description"),
        transform_fn=lambda b: {"clauses": [b["benefit_description"]], "id": 33},
    )
    if not collected:
        return None
    return [{"benefits": collected, "id": 0}]


def _extract_additional_infos_from_offers(details):
    """Extract additional_infos from all offers and flatten into a single list.

    Hadoop: offers[].additional_infos[] = [{"additional_info_type": "...", "content": "..."}, ...]
    """
    return _collect_from_offers(details, "additional_infos")


def filter_details_for_component(details_json_str, component_name):
    """Filter a details JSON blob to only the fields needed for a component.

    Mirrors the logic in ActivityContentReadInjector.filterActivityDetails.
    COMPONENT_FIELDS uses gRPC field names; GRPC_TO_HADOOP_MAP translates them
    to Hadoop JSON paths. The output JSON uses the gRPC field name as the key.

    Equivalent StarRocks SQL (example for "title" component):
        SELECT
            get_json_string(details, '$.activity_title') AS activity_title
        FROM agoda_activities.activity_details
        WHERE activityid = 984803 AND languageid = 1;

    Equivalent StarRocks SQL (example for "description" component):
        SELECT
            get_json_string(details, '$.activity_title')                    AS activity_title,
            get_json_string(details, '$.activity_description')              AS activity_description,
            get_json_string(details, '$.provider_contact.provider_name')    AS `provider_contact.provider_name`
        FROM agoda_activities.activity_details
        WHERE activityid = 984803 AND languageid = 1;

    Equivalent StarRocks SQL (example for "product-information" component):
        SELECT
            get_json_string(details, '$.activity_title')                    AS activity_title,
            get_json_string(details, '$.activity_description')              AS activity_description,
            get_json_string(details, '$.provider_contact.provider_name')    AS `provider_contact.provider_name`,
            -- additionalInfoList: extracted from offers[].additional_infos[]
            -- and flattened into a single list. Raw SQL approximation:
            get_json_string(details, '$.offers')                            AS offers_raw_additional_infos,
            get_json_string(details, '$.images')                            AS images,
            -- inclusionRefs/exclusionRefs: extracted from offers[].benefits[]
            -- filtered by benefit_type = 'INCLUSION' or 'EXCLUSION', then
            -- reshaped into gRPC format. Raw SQL approximation:
            get_json_string(details, '$.offers')                            AS offers_raw,
            get_json_string(details, '$.activity_infos')                    AS activity_infos
        FROM agoda_activities.activity_details
        WHERE activityid = 984803 AND languageid = 1;

    Args:
        details_json_str: raw JSON string of the full activity details
        component_name: one of the keys in COMPONENT_FIELDS

    Returns:
        Filtered JSON string (keys use gRPC field names)
    """
    if not details_json_str:
        return details_json_str

    details = json.loads(details_json_str)
    grpc_fields = COMPONENT_FIELDS.get(component_name.lower())
    if grpc_fields is None:
        # Unknown component: return full details
        return details_json_str

    filtered = {}
    for grpc_field in grpc_fields:
        hadoop_path = _resolve_hadoop_path(grpc_field)
        value = _extract_field(details, hadoop_path)
        if value is not None:
            filtered[grpc_field] = value

    return json.dumps(filtered, ensure_ascii=False)


def build_user_prompt(filtered_details, metadata_json, language_name):
    """Wrap filtered details using USER_PROMPT_TEMPLATE.

    Substitutes {details}, {metadata}, {language} placeholders in the template.

    Args:
        filtered_details: JSON string of filtered activity details
        metadata_json: JSON string of geo metadata
        language_name: human-readable language name (e.g., "English")

    Returns:
        Formatted user prompt string
    """
    return USER_PROMPT_TEMPLATE.format(
        details=filtered_details,
        metadata=metadata_json,
        language=language_name,
    )


def build_prompt_df(spark, details_df, components=None, target_language_ids=None):
    """Build prompts for all activity x component x target language combinations.

    Source content is always English from Hadoop. For each target language in
    TARGET_LANGUAGE_IDS (or the override), a separate prompt is generated with
    the target language name in the <language> tag.

    Args:
        spark: SparkSession
        details_df: DataFrame from fetch_activity_details() (English source)
        components: list of component names (default: all keys in COMPONENT_FIELDS)
        target_language_ids: list of target language IDs (default: TARGET_LANGUAGE_IDS)

    Returns:
        DataFrame with columns: activity_id, target_language_id, component, user_prompt
    """
    if components is None:
        components = list(COMPONENT_FIELDS.keys())
    if target_language_ids is None:
        target_language_ids = TARGET_LANGUAGE_IDS

    # Enrich with geo metadata
    enriched_df = fetch_geo_metadata(spark, details_df)
    rows = enriched_df.collect()

    prompt_rows = []
    for row in rows:
        activity_id = row["activityid"]
        details_json = row["details"]
        metadata_json = row["metadata_json"] or "{}"

        for target_lang_id in target_language_ids:
            language_name = LANGUAGE_MAP.get(target_lang_id, f"Language_{target_lang_id}")

            for component in components:
                filtered = filter_details_for_component(details_json, component)
                user_prompt = build_user_prompt(filtered, metadata_json, language_name)
                prompt_rows.append(Row(
                    activity_id=activity_id,
                    target_language_id=target_lang_id,
                    component=component,
                    user_prompt=user_prompt,
                ))

    return spark.createDataFrame(prompt_rows)


def preview_prompt(prompts_df, activity_id=None, component=None, target_language_id=None):
    """Print a single prompt for inspection.

    Args:
        prompts_df: DataFrame from build_prompt_df()
        activity_id: filter to this activity (optional, uses first if None)
        component: filter to this component (optional, uses first if None)
        target_language_id: filter to this target language (optional)
    """
    filtered = prompts_df
    if activity_id is not None:
        filtered = filtered.filter(F.col("activity_id") == activity_id)
    if component is not None:
        filtered = filtered.filter(F.col("component") == component)
    if target_language_id is not None:
        filtered = filtered.filter(F.col("target_language_id") == target_language_id)

    row = filtered.first()
    if row is None:
        print("No matching prompt found.")
        return

    lang_name = LANGUAGE_MAP.get(row["target_language_id"], row["target_language_id"])
    print(f"=== Activity {row['activity_id']} | {row['component']} | target={lang_name} ({row['target_language_id']}) ===")
    print(row["user_prompt"])
