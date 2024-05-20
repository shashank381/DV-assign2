d3.json("data.json").then(data => {
    // Parse the date and weight
    data.forEach(d => {
        d.date = new Date(d.Date);
        d.year = d.date.getFullYear();
        d.weight = +d.Weight;
    });

    // Classification mappings
    const beforeSortingMap = {
        "Reusables in Compost": "Compost",
        "Reusables in Landfill": "Landfill",
        "Reusables in Recycling": "Recycling",
        "Compost in Landfill": "Landfill",
        "Compost in Recycling": "Recycling",
        "Landfill in Compost": "Compost",
        "Landfill in Recycling": "Recycling",
        "Recycling in Compost": "Compost",
        "Recycling in Landfill": "Landfill"
    };

    const afterSortingMap = {
        "Reusables in Compost": "Recycling",
        "Reusables in Landfill": "Recycling",
        "Reusables in Recycling": "Recycling",
        "Compost in Landfill": "Compost",
        "Compost in Recycling": "Compost",
        "Landfill in Compost": "Landfill",
        "Landfill in Recycling": "Landfill",
        "Recycling in Compost": "Recycling",
        "Recycling in Landfill": "Recycling"
    };

    // Consistent color scale
    const color = d3.scaleOrdinal()
        .domain(["Compost", "Recycling", "Landfill"])
        .range(["#4caf50", "#2196f3", "#9e9e9e"]); // Green, Blue, Grey

    // Get unique years for the dropdown and sort in ascending order
    const years = [...new Set(data.map(d => d.year))].sort((a, b) => a - b);
    const yearSelect = d3.select("#year-select");

    yearSelect.selectAll("option")
        .data(years)
        .enter()
        .append("option")
        .text(d => d)
        .attr("value", d => d);

    // Initial chart update with the first year in the list
    let currentState = "before";
    let currentYear = years[0];

    // Define margins, width, and height
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 960 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    // Create the SVG container
    const svg = d3.select("#bar-chart").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Create x and y scales
    const x = d3.scaleBand().range([0, width]).padding(0.1);
    const y = d3.scaleLinear().range([height, 0]);

    // Create axes
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(0," + height + ")");

    svg.append("g")
        .attr("class", "y-axis");

    // Create the tooltip
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // Initial chart rendering
    updateStackedBarChart(data, currentYear, currentState);

    // Update chart on year selection change
    yearSelect.on("change", function() {
        currentYear = +this.value;
        updateStackedBarChart(data, currentYear, currentState);
    });

    // Toggle button
    d3.select("#toggle-button").on("click", function() {
        currentState = currentState === "before" ? "after" : "before";
        updateStackedBarChart(data, currentYear, currentState);
        d3.select(this).text(currentState === "before" ? "Show After Sorting" : "Show Before Sorting");
    });

    function updateStackedBarChart(data, year, state) {
        // Filter data for the selected year
        const yearData = data.filter(d => d.year === year);

        // Map data to before or after sorting categories
        const categorizedData = yearData.map(d => ({
            ...d,
            Stream: state === "before" ? beforeSortingMap[d.Stream] || d.Stream : afterSortingMap[d.Stream] || d.Stream
        }));

        // Ensure all streams are present
        const streams = ["Compost", "Recycling", "Landfill"];
        const emptyData = streams.reduce((acc, stream) => ({ ...acc, [stream]: 0 }), {});
        const aggregatedData = Array.from(
            d3.group(categorizedData, d => d.Building),
            ([key, values]) => ({
                Building: key,
                ...streams.reduce((acc, stream) => ({
                    ...acc,
                    [stream]: d3.sum(values, d => d.Stream === stream ? d.weight : 0)
                }), emptyData)
            })
        );

        // Stack the data
        const stack = d3.stack()
            .keys(streams)
            .value((d, key) => d[key]);
        const stackedData = stack(aggregatedData);

        // Update chart heading
        d3.select("#chart-heading").text(`Waste ${state === "before" ? "Before" : "After"} Sorting in ${year}`);

        // Update x and y domains
        x.domain(aggregatedData.map(d => d.Building));
        y.domain([0, d3.max(stackedData, d => d3.max(d, d => d[1]))]);

        // Update axes
        svg.select(".x-axis")
            .transition().duration(1000)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("font-size", "14px");

        svg.select(".y-axis")
            .transition().duration(1000)
            .style("font-size", "12px")
            .call(d3.axisLeft(y).tickFormat(d => `${d} lbs`));

        // Create layers
        const layers = svg.selectAll("g.layer")
            .data(stackedData, d => d.key);

        const layersEnter = layers.enter().append("g")
            .attr("class", "layer")
            .attr("fill", d => color(d.key));

        layersEnter.merge(layers);

        layers.exit().remove();

        // Create bars
        const bars = layersEnter.merge(layers).selectAll("rect")
            .data(d => d, d => d.data.Building);

        const barsEnter = bars.enter().append("rect")
            .attr("x", d => x(d.data.Building))
            .attr("width", x.bandwidth())
            .attr("y", height)
            .attr("height", 0)
            .on("mouseover", function(event, d) {
                const stream = d3.select(this.parentNode).datum().key;
                tooltip.transition().duration(200).style("opacity", .9);
                tooltip.html(`Stream: ${stream}<br>Weight: ${d[1] - d[0]} lbs`)
                    .style("left", (event.pageX + 5) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", () => {
                tooltip.transition().duration(500).style("opacity", 0);
            });

        barsEnter.merge(bars)
            .transition().duration(1000)
            .attr("x", d => x(d.data.Building))
            .attr("width", x.bandwidth())
            .attr("y", d => y(d[1]))
            .attr("height", d => y(d[0]) - y(d[1]));

        bars.exit().transition().duration(1000)
            .attr("y", height)
            .attr("height", 0)
            .remove();
    }
}).catch(error => {
    console.error('Error loading the data:', error);
});
