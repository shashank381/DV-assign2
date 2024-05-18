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

    // Get unique years for the dropdown
    const years = [...new Set(data.map(d => d.year))];
    const yearSelect = d3.select("#year-select");

    yearSelect.selectAll("option")
        .data(years)
        .enter()
        .append("option")
        .text(d => d)
        .attr("value", d => d);

    // Initial chart update with the first year in the list
    updateStackedBarChart(data, years[0], "before");

    // Update chart on year selection change
    yearSelect.on("change", function() {
        const selectedYear = +this.value;
        updateStackedBarChart(data, selectedYear, d3.select("#toggle-button").text().includes("After") ? "after" : "before");
    });

    // Toggle button
    d3.select("#toggle-button").on("click", function() {
        const currentText = d3.select(this).text();
        const newState = currentText.includes("After") ? "before" : "after";
        const selectedYear = +yearSelect.property("value");
        updateStackedBarChart(data, selectedYear, newState);
        d3.select(this).text(currentText.includes("After") ? "Show Before Sorting" : "Show After Sorting");
    });

    function updateStackedBarChart(data, year, state) {
        // Filter data for the selected year
        const yearData = data.filter(d => d.year === year);

        // Map data to before or after sorting categories
        const categorizedData = yearData.map(d => ({
            ...d,
            Stream: state === "before" ? beforeSortingMap[d.Stream] || d.Stream : afterSortingMap[d.Stream] || d.Stream
        }));

        // Aggregate weight by building and stream
        const aggregatedData = Array.from(
            d3.group(categorizedData, d => d.Building),
            ([key, values]) => {
                const result = { Building: key };
                d3.rollup(values, v => {
                    for (const d of v) {
                        if (!result[d.Stream]) result[d.Stream] = 0;
                        result[d.Stream] += d.weight;
                    }
                });
                return result;
            }
        );

        // Define the streams
        const streams = Array.from(new Set(categorizedData.map(d => d.Stream)));

        // Stack the data
        const stack = d3.stack()
            .keys(streams)
            .value((d, key) => d[key] || 0);
        const stackedData = stack(aggregatedData);

        // Define margins, width, and height
        const margin = { top: 20, right: 30, bottom: 40, left: 50 };
        const width = 600 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        // Clear previous chart
        d3.select("#bar-chart").selectAll("*").remove();

        const svg = d3.select("#bar-chart").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        const x = d3.scaleBand().range([0, width]).padding(0.1);
        const y = d3.scaleLinear().range([height, 0]);
        const color = d3.scaleOrdinal().domain(streams).range(d3.schemeCategory10);

        x.domain(aggregatedData.map(d => d.Building));
        y.domain([0, d3.max(stackedData, d => d3.max(d, d => d[1]))]);

        svg.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

        svg.append("g")
            .call(d3.axisLeft(y));

        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        // Create bars
        const layers = svg.selectAll("g.layer")
            .data(stackedData, d => d.key);

        layers.enter().append("g")
            .attr("class", "layer")
            .attr("fill", d => color(d.key))
            .merge(layers)
            .selectAll("rect")
            .data(d => d, d => d.data.Building)
            .enter().append("rect")
            .attr("x", d => x(d.data.Building))
            .attr("width", x.bandwidth())
            .attr("y", height)
            .attr("height", 0)
            .on("mouseover", (event, d) => {
                tooltip.transition().duration(200).style("opacity", .9);
                tooltip.html(`Building: ${d.data.Building}<br>Weight: ${d[1] - d[0]} lbs`)
                    .style("left", (event.pageX + 5) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", d => {
                tooltip.transition().duration(500).style("opacity", 0);
            })
            .transition()
            .duration(1000)
            .attr("y", d => y(d[1]))
            .attr("height", d => y(d[0]) - y(d[1]));

        layers.exit().remove();

        // Add legend
        const legend = svg.selectAll(".legend")
            .data(streams.slice().reverse())
            .enter().append("g")
            .attr("class", "legend")
            .attr("transform", (d, i) => "translate(0," + i * 20 + ")");

        legend.append("rect")
            .attr("x", width - 18)
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", color);

        legend.append("text")
            .attr("x", width - 24)
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "end")
            .text(d => d);
    }
}).catch(error => {
    console.error('Error loading the data:', error);
});
